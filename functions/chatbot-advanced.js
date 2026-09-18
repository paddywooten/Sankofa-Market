/**
 * Dialogflow NLP Integration for Sankofa Market Chatbot
 * Provides intelligent intent recognition and entity extraction
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const dialogflow = require('@google-cloud/dialogflow');

admin.initializeApp();
const db = admin.firestore();

// Initialize Dialogflow client
// Note: In production, use service account credentials
const sessionClient = new dialogflow.SessionsClient({
    keyFilename: process.env.DIALOGFLOW_CREDENTIALS || './dialogflow-credentials.json'
});

const projectId = process.env.DIALOGFLOW_PROJECT_ID || 'sankofa-market-chatbot';

/**
 * Process user message with Dialogflow NLP
 */
exports.processMessage = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { message, sessionId, pageContext } = data;
    const userId = context.auth.uid;

    try {
        // Create session path
        const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId || userId);

        // Prepare request with context
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: message,
                    languageCode: 'en-US'
                }
            },
            queryParams: {
                payloads: {
                    pageContext: pageContext || 'general',
                    userId: userId
                }
            }
        };

        // Send request to Dialogflow
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;

        // Extract intent and entities
        const intent = result.intent ? result.intent.displayName : 'Default Fallback Intent';
        const confidence = result.intentDetectionConfidence || 0;
        const entities = extractEntities(result.parameters);
        const response = result.fulfillmentText;
        const quickReplies = extractQuickReplies(result.fulfillmentMessages);

        // Log the interaction
        await logInteraction(userId, {
            message,
            intent,
            confidence,
            entities,
            response,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            intent,
            confidence,
            entities,
            response,
            quickReplies,
            fallback: intent === 'Default Fallback Intent' || confidence < 0.7
        };

    } catch (error) {
        console.error('Dialogflow error:', error);
        
        // Fallback to keyword matching if Dialogflow fails
        return {
            success: false,
            fallback: true,
            error: error.message
        };
    }
});

/**
 * Extract entities from Dialogflow parameters
 */
function extractEntities(parameters) {
    const entities = {};
    
    if (parameters.fields) {
        for (const [key, value] of Object.entries(parameters.fields)) {
            if (value.stringValue) {
                entities[key] = value.stringValue;
            } else if (value.numberValue) {
                entities[key] = value.numberValue;
            } else if (value.listValue) {
                entities[key] = value.listValue.values.map(v => v.stringValue || v.numberValue);
            }
        }
    }
    
    return entities;
}

/**
 * Extract quick replies from Dialogflow fulfillment messages
 */
function extractQuickReplies(messages) {
    const quickReplies = [];
    
    if (messages && messages.length > 0) {
        messages.forEach(msg => {
            if (msg.quickReplies && msg.quickReplies.quickReplies) {
                quickReplies.push(...msg.quickReplies.quickReplies);
            }
        });
    }
    
    return quickReplies;
}

/**
 * Log interaction for analytics
 */
async function logInteraction(userId, data) {
    try {
        await db.collection('users').doc(userId).collection('chatbot_interactions').add(data);
    } catch (error) {
        console.error('Error logging interaction:', error);
    }
}

/**
 * Train Dialogflow with new FAQ
 */
exports.trainDialogflow = functions.firestore
    .document('chatbot_faqs/{faqId}')
    .onWrite(async (change, context) => {
        const faqId = context.params.faqId;
        
        if (!change.after.exists) {
            // FAQ deleted - would need to delete intent from Dialogflow
            console.log(`FAQ ${faqId} deleted`);
            return null;
        }

        const faq = change.after.data();
        
        try {
            // Create or update intent in Dialogflow
            const intentsClient = new dialogflow.IntentsClient();
            const agentPath = intentsClient.projectAgentPath(projectId);
            
            // Prepare training phrases from keywords
            const trainingPhrases = faq.keywords.map(keyword => ({
                type: 'EXAMPLE',
                parts: [{ text: keyword }]
            }));

            // Prepare response
            const messages = [
                {
                    text: {
                        text: [faq.answer]
                    }
                }
            ];

            // Add quick replies if available
            if (faq.quickReplies && faq.quickReplies.length > 0) {
                messages.push({
                    quickReplies: {
                        quickReplies: faq.quickReplies
                    }
                });
            }

            const intent = {
                displayName: faq.id,
                trainingPhrases,
                messages,
                priority: 500000
            };

            // Check if intent exists
            const existingIntents = await intentsClient.listIntents({ parent: agentPath });
            const existingIntent = existingIntents[0].find(i => i.displayName === faq.id);

            if (existingIntent) {
                // Update existing intent
                intent.name = existingIntent.name;
                await intentsClient.updateIntent({ intent });
                console.log(`Updated intent: ${faq.id}`);
            } else {
                // Create new intent
                await intentsClient.createIntent({ parent: agentPath, intent });
                console.log(`Created intent: ${faq.id}`);
            }

            // Train the agent
            await intentsClient.trainAgent({ parent: agentPath });
            console.log('Agent training initiated');

            return null;

        } catch (error) {
            console.error('Error training Dialogflow:', error);
            return null;
        }
    });

/**
 * Get conversation history
 */
exports.getConversationHistory = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const limit = data.limit || 50;

    try {
        const snapshot = await db.collection('users')
            .doc(userId)
            .collection('chatbot_conversations')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const conversations = [];
        snapshot.forEach(doc => {
            conversations.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return {
            success: true,
            conversations: conversations.reverse()
        };

    } catch (error) {
        console.error('Error getting history:', error);
        throw new functions.https.HttpsError('internal', 'Failed to retrieve history');
    }
});

/**
 * Save conversation
 */
exports.saveConversation = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { conversationId, messages } = data;

    try {
        await db.collection('users')
            .doc(userId)
            .collection('chatbot_conversations')
            .doc(conversationId)
            .set({
                messages,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                messageCount: messages.length
            });

        return { success: true };

    } catch (error) {
        console.error('Error saving conversation:', error);
        throw new functions.https.HttpsError('internal', 'Failed to save conversation');
    }
});

/**
 * Submit user feedback
 */
exports.submitFeedback = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { messageId, rating, comment, intent } = data;

    try {
        await db.collection('chatbot_feedback').add({
            userId,
            messageId,
            rating, // 'positive' or 'negative'
            comment: comment || '',
            intent: intent || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update analytics
        await updateFeedbackAnalytics(intent, rating);

        return { success: true };

    } catch (error) {
        console.error('Error submitting feedback:', error);
        throw new functions.https.HttpsError('internal', 'Failed to submit feedback');
    }
});

/**
 * Update feedback analytics
 */
async function updateFeedbackAnalytics(intent, rating) {
    try {
        const docRef = db.collection('chatbot_analytics').doc('feedback_summary');
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            let data = doc.exists ? doc.data() : {
                totalFeedback: 0,
                positiveFeedback: 0,
                negativeFeedback: 0,
                intentBreakdown: {}
            };

            data.totalFeedback++;
            if (rating === 'positive') {
                data.positiveFeedback++;
            } else {
                data.negativeFeedback++;
            }

            if (!data.intentBreakdown[intent]) {
                data.intentBreakdown[intent] = { positive: 0, negative: 0 };
            }
            
            if (rating === 'positive') {
                data.intentBreakdown[intent].positive++;
            } else {
                data.intentBreakdown[intent].negative++;
            }

            transaction.set(docRef, data);
        });

    } catch (error) {
        console.error('Error updating analytics:', error);
    }
}

/**
 * Create support ticket (human handoff)
 */
exports.createSupportTicket = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { subject, description, conversationHistory, priority } = data;

    try {
        // Get user info
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.exists ? userDoc.data() : {};

        // Create ticket
        const ticketRef = await db.collection('support_tickets').add({
            userId,
            userEmail: user.email || 'unknown',
            userName: user.firstName ? `${user.firstName} ${user.lastName}` : 'Unknown User',
            subject: subject || 'Chatbot Escalation',
            description: description || 'User requested human support',
            conversationHistory: conversationHistory || [],
            priority: priority || 'medium',
            status: 'open',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Notify admins (would integrate with email/notification system)
        await notifyAdmins({
            type: 'new_ticket',
            ticketId: ticketRef.id,
            userId,
            subject
        });

        return {
            success: true,
            ticketId: ticketRef.id,
            message: 'Support ticket created. Our team will contact you soon.'
        };

    } catch (error) {
        console.error('Error creating ticket:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create ticket');
    }
});

/**
 * Notify admins (placeholder - integrate with email system)
 */
async function notifyAdmins(data) {
    try {
        // In production, integrate with SendGrid, Firebase Cloud Messaging, etc.
        await db.collection('admin_notifications').add({
            ...data,
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('Admin notification created:', data);
    } catch (error) {
        console.error('Error notifying admins:', error);
    }
}

/**
 * Get smart suggestions based on context
 */
exports.getSmartSuggestions = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { pageContext, userHistory } = data;

    try {
        const suggestions = await generateSuggestions(userId, pageContext, userHistory);

        return {
            success: true,
            suggestions
        };

    } catch (error) {
        console.error('Error getting suggestions:', error);
        return {
            success: false,
            suggestions: getDefaultSuggestions(pageContext)
        };
    }
});

/**
 * Generate smart suggestions
 */
async function generateSuggestions(userId, pageContext, userHistory) {
    const suggestions = [];

    // Context-based suggestions
    if (pageContext === 'product_detail') {
        suggestions.push(
            'How do I contact the seller?',
            'Is this item still available?',
            'What are the delivery options?'
        );
    } else if (pageContext === 'search') {
        suggestions.push(
            'How do I filter results?',
            'Can I search by image?',
            'How do I save searches?'
        );
    } else if (pageContext === 'dashboard') {
        suggestions.push(
            'How do I list an item?',
            'How do I withdraw my earnings?',
            'Where can I see my sales?'
        );
    }

    // Add general suggestions
    suggestions.push(
        'How does payment work?',
        'What are the safety tips?',
        'Contact support'
    );

    return suggestions.slice(0, 5); // Return top 5
}

/**
 * Get default suggestions for context
 */
function getDefaultSuggestions(pageContext) {
    const defaults = {
        general: [
            'How do I create an account?',
            'How does payment work?',
            'How do I list an item?',
            'What are the delivery options?',
            'Contact support'
        ],
        product_detail: [
            'How do I contact the seller?',
            'Is my payment safe?',
            'What are the delivery options?',
            'How do I raise a dispute?',
            'Contact support'
        ],
        search: [
            'How do I use filters?',
            'Can I search by image?',
            'How do I sort results?',
            'How do I save searches?',
            'Contact support'
        ],
        dashboard: [
            'How do I list an item?',
            'How do I withdraw money?',
            'Where are my orders?',
            'How do I edit my profile?',
            'Contact support'
        ]
    };

    return defaults[pageContext] || defaults.general;
}

/**
 * Scheduled cleanup for old conversations (90 days)
 */
exports.cleanupOldConversations = functions.pubsub
    .schedule('0 0 * * 0') // Every Sunday at midnight
    .timeZone('Africa/Accra')
    .onRun(async (context) => {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        try {
            const usersSnapshot = await db.collection('users').get();
            
            for (const userDoc of usersSnapshot.docs) {
                const conversationsSnapshot = await db.collection('users')
                    .doc(userDoc.id)
                    .collection('chatbot_conversations')
                    .where('timestamp', '<', ninetyDaysAgo)
                    .limit(500)
                    .get();

                if (!conversationsSnapshot.empty) {
                    const batch = db.batch();
                    conversationsSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    console.log(`Cleaned ${conversationsSnapshot.size} old conversations for user ${userDoc.id}`);
                }
            }

            return null;
        } catch (error) {
            console.error('Cleanup error:', error);
            return null;
        }
    });

/* Premium listing video processing. Runs in the seller's browser; the original
   file is never uploaded. Output is capped at 480p, 30 seconds, and 8 MB. */
(function (global, document) {
    'use strict';

    var MAX_SECONDS = 30;
    var MAX_SOURCE_BYTES = 100 * 1024 * 1024;
    var MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
    var MAX_WIDTH = 854;
    var MAX_HEIGHT = 480;

    function isActivePremiumSeller(profile, now) {
        profile = profile || {};
        if (profile.isPremium !== true) return false;
        var expiry = profile.premiumExpiry;
        var expiryDate = expiry && expiry.toDate ? expiry.toDate() : (expiry ? new Date(expiry) : null);
        return !!expiryDate && isFinite(expiryDate.getTime()) && expiryDate.getTime() > (now || Date.now());
    }

    function isActivePublicPremiumSeller(profile, now) {
        profile = profile || {};
        var tier = String(profile.tier || '').toLowerCase();
        if (['bronze', 'silver', 'gold', 'diamond'].indexOf(tier) === -1) return false;
        var expiry = profile.premiumExpiry;
        var expiryDate = expiry && expiry.toDate ? expiry.toDate() : (expiry ? new Date(expiry) : null);
        var currentTime = typeof now === 'number' && isFinite(now) ? now : Date.now();
        return !!expiryDate && isFinite(expiryDate.getTime()) && expiryDate.getTime() > currentTime;
    }

    function outputDimensions(width, height) {
        width = Number(width) || 0;
        height = Number(height) || 0;
        if (!(width > 0 && height > 0)) return { width: 0, height: 0 };
        var scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
        return {
            width: Math.max(2, Math.floor(width * scale / 2) * 2),
            height: Math.max(2, Math.floor(height * scale / 2) * 2)
        };
    }

    function storagePath(userId, productId) {
        userId = String(userId || '');
        productId = String(productId || '');
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId) || !/^[A-Za-z0-9_-]{1,150}$/.test(productId)) {
            throw new Error('Could not create a safe video storage path.');
        }
        return 'products/' + userId + '/videos/' + productId + '/listing-video';
    }

    function loadPremiumStatus(userId) {
        if (!userId || typeof firebaseDB === 'undefined' || !firebaseDB) return Promise.resolve(false);
        var ref = firebaseDB.collection('users').doc(userId);
        function readPublicMirror() {
            var publicRef = firebaseDB.collection('sellerPublic').doc(userId);
            return publicRef.get({ source: 'server' }).catch(function () { return publicRef.get(); }).then(function (doc) {
                return !!(doc.exists && isActivePublicPremiumSeller(doc.data()));
            }).catch(function () { return false; });
        }
        return ref.get({ source: 'server' }).catch(function () { return ref.get(); }).then(function (doc) {
            if (doc && doc.exists && isActivePremiumSeller(doc.data())) return true;
            // The public badge is a server-written mirror of an active paid tier. It is a
            // safe UI fallback if the private profile read is stale; Storage/Firestore rules
            // still make the final Premium decision when the seller saves.
            return readPublicMirror();
        }).catch(function () { return readPublicMirror(); });
    }

    function chooseRecorderMimeType() {
        if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot process listing videos. Try a recent Chrome, Edge, or Safari browser.');
        if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
        var candidates = [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp8',
            'video/mp4'
        ];
        for (var i = 0; i < candidates.length; i++) {
            try { if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i]; } catch (e) {}
        }
        throw new Error('This browser cannot convert video to a supported format. Try a recent Chrome, Edge, or Safari browser.');
    }

    function processVideo(file, onProgress) {
        return new Promise(async function (resolve, reject) {
            if (!file) { reject(new Error('Choose a video first.')); return; }
            if (file.type && !/^video\//i.test(file.type)) { reject(new Error('Choose a video file.')); return; }
            if (file.size > MAX_SOURCE_BYTES) { reject(new Error('The original video must be 100 MB or smaller.')); return; }
            if (!global.MediaRecorder || !document.createElement('canvas').captureStream) {
                reject(new Error('Automatic video conversion is not supported by this browser. Try a recent Chrome, Edge, or Safari browser.'));
                return;
            }

            var objectUrl = null;
            var video = null;
            var audioContext = null;
            var canvasStream = null;
            var frameRequest = null;
            var stopTimer = null;
            var finished = false;
            var stopRequested = false;
            var recorder = null;

            function cleanup() {
                if (frameRequest && global.cancelAnimationFrame) global.cancelAnimationFrame(frameRequest);
                if (stopTimer) global.clearTimeout(stopTimer);
                try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (e) {}
                try { if (canvasStream) canvasStream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) {}
                try { if (audioContext && audioContext.close) audioContext.close(); } catch (e) {}
                if (video) {
                    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
                    if (video.parentNode) video.parentNode.removeChild(video);
                }
                if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) {} }
            }
            function fail(error) {
                if (finished) return;
                finished = true;
                cleanup();
                reject(error instanceof Error ? error : new Error(String(error || 'Video processing failed.')));
            }

            try {
                var mimeType = chooseRecorderMimeType();
                objectUrl = URL.createObjectURL(file);
                video = document.createElement('video');
                video.preload = 'auto';
                video.playsInline = true;
                video.muted = true;
                video.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
                document.body.appendChild(video);

                var metadataReady = new Promise(function (resolveMeta, rejectMeta) {
                    var timer = global.setTimeout(function () { rejectMeta(new Error('The video could not be opened. Try a different file.')); }, 20000);
                    video.onloadedmetadata = function () { global.clearTimeout(timer); resolveMeta(); };
                    video.onerror = function () { global.clearTimeout(timer); rejectMeta(new Error('The video could not be opened. Try a different file.')); };
                });
                video.src = objectUrl;
                await metadataReady;
                if (isNaN(video.duration) || !(video.duration > 0) || !video.videoWidth || !video.videoHeight) {
                    throw new Error('This video does not have readable length or dimensions.');
                }

                var dimensions = outputDimensions(video.videoWidth, video.videoHeight);
                if (!dimensions.width || !dimensions.height) throw new Error('Could not read the video dimensions.');
                // Some valid WebM files report Infinity for duration. We still process them
                // safely: stop after 30 seconds or when the file ends, whichever comes first.
                var durationSeconds = isFinite(video.duration) ? Math.min(MAX_SECONDS, video.duration) : MAX_SECONDS;
                var recordedDurationSeconds = durationSeconds;
                var canvas = document.createElement('canvas');
                canvas.width = dimensions.width;
                canvas.height = dimensions.height;
                var context = canvas.getContext('2d', { alpha: false });
                if (!context) throw new Error('This browser cannot prepare the video.');
                canvasStream = canvas.captureStream(24);

                // Preserve audio when Web Audio is available, while keeping playback silent.
                // If the browser cannot provide an audio track, the video is still processed.
                try {
                    var AudioContextCtor = global.AudioContext || global.webkitAudioContext;
                    if (AudioContextCtor) {
                        audioContext = new AudioContextCtor();
                        var source = audioContext.createMediaElementSource(video);
                        var destination = audioContext.createMediaStreamDestination();
                        var silentGain = audioContext.createGain();
                        silentGain.gain.value = 0;
                        source.connect(destination);
                        source.connect(silentGain);
                        silentGain.connect(audioContext.destination);
                        await audioContext.resume().catch(function () {});
                        var audioTracks = destination.stream.getAudioTracks();
                        audioTracks.forEach(function (track) { canvasStream.addTrack(track); });
                        if (audioTracks.length) video.muted = false;
                    }
                } catch (audioError) {
                    video.muted = true;
                }

                var options = { videoBitsPerSecond: 600000, audioBitsPerSecond: 96000 };
                if (mimeType) options.mimeType = mimeType;
                recorder = new MediaRecorder(canvasStream, options);
                var chunks = [];
                var stopped = new Promise(function (resolveStop, rejectStop) {
                    recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
                    recorder.onerror = function (event) { rejectStop(event.error || new Error('Video conversion failed.')); };
                    recorder.onstop = function () {
                        resolveStop(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
                    };
                });
                recorder.start(1000);

                // The file selection is a user gesture; start playback now. If sound is
                // unavailable, retry muted so the seller can still upload a silent clip.
                try { await video.play(); }
                catch (playError) {
                    video.muted = true;
                    await video.play();
                }
                var startTime = video.currentTime || 0;
                function stopRecording(){
                    if (finished || stopRequested || !recorder || recorder.state !== 'recording') return;
                    var elapsed = Math.max(0, (video.currentTime || 0) - startTime);
                    recordedDurationSeconds = Math.min(durationSeconds, Math.max(elapsed, 0.1));
                    stopRequested = true;
                    try { recorder.stop(); } catch (e) {}
                }
                function drawFrame(){
                    if (!recorder || recorder.state !== 'recording' || finished || stopRequested) return;
                    if (video.readyState >= 2){
                        try { context.drawImage(video, 0, 0, dimensions.width, dimensions.height); } catch (e) {}
                    }
                    var elapsed = Math.max(0, (video.currentTime || 0) - startTime);
                    if (typeof onProgress === 'function') onProgress(Math.min(99, Math.round(elapsed / durationSeconds * 100)));
                    if (elapsed >= durationSeconds || video.ended){ stopRecording(); return; }
                    frameRequest = global.requestAnimationFrame(drawFrame);
                }
                stopTimer = global.setTimeout(stopRecording, Math.ceil(durationSeconds * 1000) + 8000);
                frameRequest = global.requestAnimationFrame(drawFrame);
                var resultBlob = await stopped;
                if (resultBlob.size > MAX_OUTPUT_BYTES) throw new Error('The processed video is over 8 MB. Choose a shorter or lower-quality original.');
                if (resultBlob.size < 1000) throw new Error('The processed video is empty. Choose another clip.');
                if (!/^video\//i.test(resultBlob.type)) throw new Error('The browser produced an unsupported video format. Try a recent Chrome or Safari browser.');
                if (typeof onProgress === 'function') onProgress(100);
                finished = true;
                cleanup();
                resolve({ blob: resultBlob, durationSeconds: Math.min(MAX_SECONDS, Math.round(recordedDurationSeconds * 10) / 10), width: dimensions.width, height: dimensions.height, mimeType: resultBlob.type });
            } catch (error) {
                fail(error);
            }
        });
    }

    function uploadVideo(blob, userId, productId, onProgress) {
        if (typeof firebase === 'undefined' || !firebase.storage) return Promise.reject(new Error('Video storage is not available.'));
        var signedInUser = null;
        try { signedInUser = firebase.auth().currentUser; } catch (e) {}
        if (!signedInUser || String(signedInUser.uid) !== String(userId)) {
            return Promise.reject(new Error('Please sign in as the seller who owns this listing, then retry.'));
        }
        if (!blob || Number(blob.size) > MAX_OUTPUT_BYTES) return Promise.reject(new Error('The processed video must be 8 MB or smaller.'));
        var path = storagePath(userId, productId);
        var contentType = String(blob.type || 'video/webm').split(';')[0].toLowerCase();
        if (contentType !== 'video/webm' && contentType !== 'video/mp4') {
            return Promise.reject(new Error('The browser produced an unsupported video format: ' + (contentType || 'unknown') + '.'));
        }
        return new Promise(function (resolve, reject) {
            var ref = firebase.storage().ref().child(path);
            var task = null;
            var timeout = null;
            var settled = false;
            function clearUploadTimeout() {
                if (timeout) { global.clearTimeout(timeout); timeout = null; }
            }
            function fail(error) {
                if (settled) return;
                settled = true;
                clearUploadTimeout();
                reject(error instanceof Error ? error : new Error('Video upload failed.'));
            }
            function succeed() {
                if (settled) return;
                settled = true;
                clearUploadTimeout();
                resolve({ path: path, ref: task.snapshot.ref || ref });
            }
            function armUploadTimeout() {
                clearUploadTimeout();
                timeout = global.setTimeout(function () {
                    fail(new Error('Firebase has not confirmed the upload for 90 seconds. Check your connection, then tap Save changes to retry.'));
                    try { if (task && task.cancel) task.cancel(); } catch (e) {}
                }, 90000);
            }
            try {
                task = ref.put(blob, { contentType: contentType, cacheControl: 'public,max-age=31536000' });
                armUploadTimeout();
                task.on('state_changed', function (snapshot) {
                    armUploadTimeout();
                    if (typeof onProgress === 'function') onProgress(Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100));
                }, fail, succeed);
            } catch (error) {
                fail(error);
            }
        });
    }

    function deleteVideo(path) {
        if (!path || typeof firebase === 'undefined' || !firebase.storage) return Promise.resolve(false);
        return firebase.storage().ref().child(path).delete().then(function () { return true; }).catch(function () { return false; });
    }

    function clearPreview(container){
        if (!container) return;
        var oldUrl = container.getAttribute('data-video-preview-url');
        if (oldUrl){ try{ URL.revokeObjectURL(oldUrl); }catch(e){} }
        container.removeAttribute('data-video-preview-url');
        container.innerHTML = '';
    }

    function renderPreview(container, processed){
        if (!container || !processed || !processed.blob) return;
        clearPreview(container);
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'none';
        var previewUrl = URL.createObjectURL(processed.blob);
        container.setAttribute('data-video-preview-url', previewUrl);
        video.src = previewUrl;
        video.style.cssText = 'display:block;width:100%;max-width:520px;max-height:320px;background:#111;border-radius:10px;margin-top:0.5rem;';
        container.appendChild(video);
    }

    function initPublishVideoInput(){
        var input = document.getElementById('listingVideoInput');
        if (!input) return;
        var label = document.getElementById('listingVideoPickerLabel');
        var note = document.getElementById('listingVideoPlanNote');
        var status = document.getElementById('listingVideoStatus');
        var preview = document.getElementById('listingVideoPreview');
        input.disabled = true;
        global._smListingVideoSelected = false;
        global._smListingVideoDraft = null;
        global._smListingVideoError = '';
        global._smListingVideoProcessing = null;
        var activePremium = false;

        function setNote(text, showPicker){
            if (note) note.textContent = text;
            if (label) label.style.display = showPicker ? 'block' : 'none';
        }
        var auth = typeof firebaseAuth !== 'undefined' ? firebaseAuth : (global.firebase && global.firebase.auth ? global.firebase.auth() : null);
        var db = typeof firebaseDB !== 'undefined' ? firebaseDB : null;
        if (!auth || !db){ setNote('Sign in with an active Premium account to add one listing video.', false); return; }
        auth.onAuthStateChanged(function(user){
            if (!user){ setNote('Sign in with an active Premium account to add one listing video.', false); return; }
            loadPremiumStatus(user.uid).then(function(active){
                activePremium = active;
                input.disabled = !active;
                setNote(active
                    ? 'Premium feature: one video per listing. We convert it on this device to max 480p, trim it to 30 seconds, and keep the processed file under 8 MB.'
                    : 'One listing video is available to active Premium sellers only. Upgrade to Premium to add one.', active);
            });
        });

        input.addEventListener('change', function(){
            var file = input.files && input.files[0];
            global._smListingVideoSelected = !!file;
            global._smListingVideoDraft = null;
            global._smListingVideoError = '';
            if (preview) clearPreview(preview);
            if (!file){ if (status) status.textContent = ''; input.disabled = !activePremium; return; }
            if (input.disabled){
                global._smListingVideoError = 'An active Premium plan is required to upload a listing video.';
                if (status) status.textContent = global._smListingVideoError;
                input.value = '';
                global._smListingVideoSelected = false;
                return;
            }
            input.disabled = true;
            if (status) status.textContent = 'Converting video on this device… 0%';
            global._smListingVideoProcessing = processVideo(file, function(percent){
                if (status) status.textContent = 'Converting video on this device… ' + percent + '%';
            }).then(function(processed){
                global._smListingVideoDraft = processed;
                if (status) status.textContent = 'Preview ready (not uploaded yet): ' + processed.width + '×' + processed.height + ', ' + processed.durationSeconds + ' seconds, ' + (processed.blob.size / 1024 / 1024).toFixed(1) + ' MB. Publish the listing to attach it.';
                renderPreview(preview, processed);
                return processed;
            }).catch(function(error){
                global._smListingVideoDraft = null;
                global._smListingVideoSelected = false;
                global._smListingVideoError = error && error.message ? error.message : 'Video processing failed.';
                input.value = '';
                if (status) status.textContent = global._smListingVideoError + ' You can choose another video or continue without one.';
                return null;
            }).finally(function(){
                global._smListingVideoProcessing = null;
                input.disabled = !activePremium;
            });
        });
    }

    global.SankofaListingVideo = {
        maxSeconds: MAX_SECONDS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
        isActivePremiumSeller: isActivePremiumSeller,
        outputDimensions: outputDimensions,
        storagePath: storagePath,
        process: processVideo,
        upload: uploadVideo,
        delete: deleteVideo,
        clearPreview: clearPreview,
        renderPreview: renderPreview,
        loadPremiumStatus: loadPremiumStatus,
        initPublishVideoInput: initPublishVideoInput
    };

    if (document && document.addEventListener) {
        document.addEventListener('DOMContentLoaded', initPublishVideoInput);
    }
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);

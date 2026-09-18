/**
 * Sankofa Market - Hero Carousel
 * Auto-swiping promotional carousel with touch support
 */

document.addEventListener('DOMContentLoaded', function() {
    initCarousel();
});

function initCarousel() {
    const track = document.getElementById('carouselTrack');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    const dotsContainer = document.getElementById('carouselDots');
    const progressBar = document.getElementById('carouselProgress');
    
    if (!track || !dotsContainer) return;
    
    const slides = track.querySelectorAll('.carousel-slide');
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    const totalSlides = slides.length;
    
    let currentIndex = 0;
    let autoPlayInterval = null;
    let progressInterval = null;
    let progressValue = 0;
    const autoPlayDelay = 5000; // 5 seconds per slide
    let isTransitioning = false;
    
    // Touch/Swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let isDragging = false;
    
    // Go to specific slide
    function goToSlide(index) {
        if (isTransitioning) return;
        isTransitioning = true;
        
        currentIndex = index;
        
        // Handle wrap-around
        if (currentIndex >= totalSlides) currentIndex = 0;
        if (currentIndex < 0) currentIndex = totalSlides - 1;
        
        // Move track
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        
        // Update dots
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
        });
        
        // Reset progress
        resetProgress();
        
        setTimeout(() => {
            isTransitioning = false;
        }, 600);
    }
    
    // Next slide
    function nextSlide() {
        goToSlide(currentIndex + 1);
    }
    
    // Previous slide
    function prevSlide() {
        goToSlide(currentIndex - 1);
    }
    
    // Progress bar animation
    function startProgress() {
        progressValue = 0;
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        
        progressInterval = setInterval(() => {
            progressValue += (100 / (autoPlayDelay / 30));
            if (progressBar) {
                progressBar.style.width = `${Math.min(progressValue, 100)}%`;
            }
        }, 30);
    }
    
    function resetProgress() {
        clearInterval(progressInterval);
        progressValue = 0;
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        startProgress();
    }
    
    // Auto-play
    function startAutoPlay() {
        stopAutoPlay();
        startProgress();
        autoPlayInterval = setInterval(() => {
            nextSlide();
        }, autoPlayDelay);
    }
    
    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
        clearInterval(progressInterval);
        autoPlayInterval = null;
    }
    
    // Event Listeners - Navigation buttons
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevSlide();
            restartAutoPlay();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            restartAutoPlay();
        });
    }
    
    // Event Listeners - Dots
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            goToSlide(index);
            restartAutoPlay();
        });
    });
    
    // Restart auto-play after user interaction
    function restartAutoPlay() {
        stopAutoPlay();
        startAutoPlay();
    }
    
    // Pause on hover (desktop)
    const carouselWrapper = document.querySelector('.hero-carousel');
    if (carouselWrapper) {
        carouselWrapper.addEventListener('mouseenter', () => {
            stopAutoPlay();
        });
        
        carouselWrapper.addEventListener('mouseleave', () => {
            startAutoPlay();
        });
    }
    
    // Touch/Swipe support
    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isDragging = true;
        stopAutoPlay();
    }, { passive: true });
    
    track.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    track.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        const minSwipe = 50;
        
        // Only handle horizontal swipes (ignore vertical scrolling)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipe) {
            if (diffX > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        
        startAutoPlay();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Only handle if carousel is in viewport
        const rect = carouselWrapper?.getBoundingClientRect();
        if (!rect) return;
        
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
        
        if (e.key === 'ArrowLeft') {
            prevSlide();
            restartAutoPlay();
        } else if (e.key === 'ArrowRight') {
            nextSlide();
            restartAutoPlay();
        }
    });
    
    // Visibility API - pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    });
    
    // Add slide entrance animations
    slides.forEach((slide, index) => {
        const text = slide.querySelector('.carousel-text');
        const image = slide.querySelector('.carousel-image');
        
        if (text) {
            text.style.opacity = '0';
            text.style.transform = 'translateX(-30px)';
            text.style.transition = 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s';
        }
        
        if (image) {
            image.style.opacity = '0';
            image.style.transform = 'translateX(30px)';
            image.style.transition = 'opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s';
        }
    });
    
    // Animate current slide on transition
    track.addEventListener('transitionend', () => {
        animateCurrentSlide();
    });
    
    function animateCurrentSlide() {
        // Reset all slides
        slides.forEach((slide) => {
            const text = slide.querySelector('.carousel-text');
            const image = slide.querySelector('.carousel-image');
            if (text) {
                text.style.opacity = '0';
                text.style.transform = 'translateX(-30px)';
            }
            if (image) {
                image.style.opacity = '0';
                image.style.transform = 'translateX(30px)';
            }
        });
        
        // Animate current slide
        const currentSlide = slides[currentIndex];
        const text = currentSlide.querySelector('.carousel-text');
        const image = currentSlide.querySelector('.carousel-image');
        
        if (text) {
            text.style.opacity = '1';
            text.style.transform = 'translateX(0)';
        }
        if (image) {
            image.style.opacity = '1';
            image.style.transform = 'translateX(0)';
        }
    }
    
    // Initialize - animate first slide
    setTimeout(() => {
        animateCurrentSlide();
    }, 100);
    
    // Start auto-play
    startAutoPlay();
    
    console.log('🎠 Carousel initialized with', totalSlides, 'slides');
}

// Export
window.Carousel = {
    init: initCarousel
};

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Simple parallax effect on scroll
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('header');
    const speed = 0.5;
    parallax.style.transform = `translateY(${scrolled * speed}px)`;
});

// Add a simple interaction to skills
document.querySelectorAll('.skill').forEach(skill => {
    skill.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
        this.style.transition = 'transform 0.3s ease';
    });
    
    skill.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
});

console.log('Website loaded successfully! 🚀');
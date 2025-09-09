// Back to top functionality
        window.addEventListener('scroll', function() {
            const backToTopButton = document.querySelector('.back-to-top');
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });

        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // Fix encoded character
        document.addEventListener('DOMContentLoaded', function() {
            const text = document.querySelector('#d3');
            if (text) {
                text.innerHTML = text.innerHTML.replace('beginnerâ€™s', 'beginner\'s');
            }
        });

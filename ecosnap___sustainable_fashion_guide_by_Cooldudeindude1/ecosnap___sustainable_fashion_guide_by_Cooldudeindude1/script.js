document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animation on scroll
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.bottom >= 0
        );
    }

    function handleScrollAnimation() {
        const cards = document.querySelectorAll('.company-card, .alt-card');
        
        cards.forEach(card => {
            if (isInViewport(card) && !card.classList.contains('animated')) {
                card.classList.add('animated');
                card.style.animation = 'fadeInUp 0.8s ease forwards';
            }
        });
    }

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .company-card, .alt-card {
            opacity: 0;
        }
    `;
    document.head.appendChild(style);

    // Initial check and event listener
    handleScrollAnimation();
    window.addEventListener('scroll', handleScrollAnimation);

    // Initialize WebSocket for community alternatives
    const room = new WebsimSocket();
    let userRating = 0;
    let selectedAlternativeId = null;

    // DOM Elements
    const addAlternativeBtn = document.getElementById('add-alternative-btn');
    const alternativeModal = document.getElementById('alternative-modal');
    const commentModal = document.getElementById('comment-modal');
    const reportModal = document.getElementById('report-modal');
    const alternativeForm = document.getElementById('alternative-form');
    const commentForm = document.getElementById('comment-form');
    const reportForm = document.getElementById('report-form');
    const alternativesContainer = document.getElementById('community-alternatives-container');
    const sortSelector = document.getElementById('sort-selector');
    const ratingStars = document.querySelectorAll('.rating-stars i');
    const ratingValue = document.getElementById('rating-value');
    const closeButtons = document.querySelectorAll('.close-modal');
    const reportAlternativeBtn = document.getElementById('report-alternative');

    // Event Listeners
    addAlternativeBtn.addEventListener('click', openAlternativeModal);
    alternativeForm.addEventListener('submit', handleAlternativeSubmit);
    commentForm.addEventListener('submit', handleCommentSubmit);
    reportForm.addEventListener('submit', handleReportSubmit);
    sortSelector.addEventListener('change', loadAlternatives);
    reportAlternativeBtn.addEventListener('click', openReportModal);

    // Close modals when clicking close button or outside
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            alternativeModal.style.display = 'none';
            commentModal.style.display = 'none';
            reportModal.style.display = 'none';
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target === alternativeModal) alternativeModal.style.display = 'none';
        if (event.target === commentModal) commentModal.style.display = 'none';
        if (event.target === reportModal) reportModal.style.display = 'none';
    });

    // Rating stars functionality
    ratingStars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            highlightStars(rating);
        });

        star.addEventListener('mouseout', function() {
            highlightStars(userRating);
        });

        star.addEventListener('click', function() {
            userRating = parseInt(this.getAttribute('data-rating'));
            highlightStars(userRating);
            ratingValue.textContent = `${userRating}/10`;
        });
    });

    // File upload handler
    document.getElementById('alt-logo-upload').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Please select an image under 5MB.');
            return;
        }
        
        try {
            const logoUrl = await websim.upload(file);
            document.getElementById('alt-logo').value = logoUrl;
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload image. Please try again or use a URL instead.');
        }
    });

    // Load alternatives on page load
    loadAlternatives();
    
    // Subscribe to alternative changes
    room.collection('eco_alternative').subscribe(function() {
        loadAlternatives();
    });

    // Functions
    function openAlternativeModal() {
        alternativeForm.reset();
        alternativeModal.style.display = 'block';
    }

    function openCommentModal(alternativeId) {
        selectedAlternativeId = alternativeId;
        document.getElementById('comment-alternative-id').value = alternativeId;
        userRating = 0;
        highlightStars(0);
        ratingValue.textContent = '0/10';
        commentForm.reset();
        loadComments(alternativeId);
        commentModal.style.display = 'block';
    }

    function openReportModal() {
        document.getElementById('report-alternative-id').value = selectedAlternativeId;
        reportForm.reset();
        reportModal.style.display = 'block';
    }

    function highlightStars(rating) {
        ratingStars.forEach(star => {
            const starRating = parseInt(star.getAttribute('data-rating'));
            if (starRating <= rating) {
                star.classList.remove('far');
                star.classList.add('fas');
            } else {
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    }

    async function handleAlternativeSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('alt-title').value;
        const website = document.getElementById('alt-website').value;
        const description = document.getElementById('alt-description').value;
        const logoUrl = document.getElementById('alt-logo').value;
        const category = document.getElementById('alt-category').value;
        
        try {
            await room.collection('eco_alternative').create({
                title,
                website,
                description,
                logo_url: logoUrl || null,
                category,
                avg_rating: 0,
                rating_count: 0,
                total_rating: 0
            });
            
            alternativeModal.style.display = 'none';
            showNotification('Alternative added successfully!');
        } catch (error) {
            console.error('Error adding alternative:', error);
            alert('Failed to add alternative. Please try again.');
        }
    }

    async function handleCommentSubmit(e) {
        e.preventDefault();
        
        const alternativeId = document.getElementById('comment-alternative-id').value;
        const commentText = document.getElementById('comment-text').value;
        
        if (userRating === 0) {
            alert('Please select a rating before submitting your comment.');
            return;
        }
        
        try {
            // Add the comment
            await room.collection('eco_comment').create({
                alternative_id: alternativeId,
                comment: commentText,
                rating: userRating
            });
            
            // Update the alternative's rating
            const alternative = await getAlternativeById(alternativeId);
            
            if (alternative) {
                const newTotalRating = alternative.total_rating + userRating;
                const newRatingCount = alternative.rating_count + 1;
                const newAvgRating = newTotalRating / newRatingCount;
                
                await room.collection('eco_alternative').update(alternativeId, {
                    total_rating: newTotalRating,
                    rating_count: newRatingCount,
                    avg_rating: newAvgRating
                });
            }
            
            commentForm.reset();
            userRating = 0;
            highlightStars(0);
            ratingValue.textContent = '0/10';
            loadComments(alternativeId);
            showNotification('Comment added successfully!');
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Failed to add comment. Please try again.');
        }
    }

    async function handleReportSubmit(e) {
        e.preventDefault();
        
        const alternativeId = document.getElementById('report-alternative-id').value;
        const reason = document.getElementById('report-reason').value;
        const details = document.getElementById('report-details').value;
        
        try {
            await room.collection('eco_report').create({
                alternative_id: alternativeId,
                reason,
                details
            });
            
            reportModal.style.display = 'none';
            commentModal.style.display = 'none';
            showNotification('Report submitted successfully. Thank you for helping keep our community safe!');
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        }
    }

    async function loadAlternatives() {
        const sortType = sortSelector.value;
        alternativesContainer.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-leaf fa-spin"></i>
                <span>Loading alternatives...</span>
            </div>
        `;
        
        try {
            let alternatives = room.collection('eco_alternative').getList();
            
            // Sort based on selection
            if (sortType === 'highest') {
                alternatives.sort((a, b) => b.avg_rating - a.avg_rating);
            } else if (sortType === 'lowest') {
                alternatives.sort((a, b) => a.avg_rating - b.avg_rating);
            } else {
                // 'newest' is default (already sorted by created_at desc)
            }
            
            if (alternatives.length === 0) {
                alternativesContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-leaf"></i>
                        <h3>No Alternatives Yet</h3>
                        <p>Be the first to share an eco-friendly alternative with the community!</p>
                    </div>
                `;
                return;
            }
            
            alternativesContainer.innerHTML = '';
            
            alternatives.forEach(alt => {
                const card = createAlternativeCard(alt);
                alternativesContainer.appendChild(card);
            });
        } catch (error) {
            console.error('Error loading alternatives:', error);
            alternativesContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Oops! Something went wrong</h3>
                    <p>We couldn't load the alternatives. Please refresh the page and try again.</p>
                </div>
            `;
        }
    }

    function createAlternativeCard(alt) {
        const card = document.createElement('div');
        card.className = 'community-alt-card';
        
        const ratingDisplay = alt.rating_count > 0 
            ? `<span class="rating-value">${alt.avg_rating.toFixed(1)}/10</span> (${alt.rating_count})`
            : 'No ratings yet';
        
        card.innerHTML = `
            <div class="community-alt-header">
                <div class="community-alt-logo">
                    ${alt.logo_url 
                        ? `<img src="${alt.logo_url}" alt="${alt.title} logo">` 
                        : `<i class="fas fa-leaf default-logo"></i>`}
                </div>
                <div class="community-alt-title">
                    <h3>${alt.title}</h3>
                    <span class="category-tag">${alt.category}</span>
                </div>
            </div>
            <div class="community-alt-content">
                <p>${alt.description}</p>
            </div>
            <div class="community-alt-stats">
                <div class="community-alt-rating">
                    <i class="fas fa-star"></i>
                    ${ratingDisplay}
                </div>
                <div class="community-alt-comments" data-id="${alt.id}">
                    <i class="fas fa-comment"></i>
                    <span>Comments</span>
                </div>
            </div>
            <div class="community-alt-footer">
                <div class="community-alt-user">
                    <div class="user-avatar">
                        <img src="https://images.websim.ai/avatar/${alt.username}" alt="${alt.username}">
                    </div>
                    <span>Added by ${alt.username}</span>
                </div>
                <a href="${alt.website}" target="_blank" class="visit-site">
                    <span>Visit Site</span>
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;
        
        // Add event listener for comments button
        card.querySelector('.community-alt-comments').addEventListener('click', function() {
            const alternativeId = this.getAttribute('data-id');
            openCommentModal(alternativeId);
        });
        
        return card;
    }

    async function loadComments(alternativeId) {
        const commentsContainer = document.getElementById('comments-container');
        commentsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
        
        try {
            const comments = room.collection('eco_comment')
                .filter({ alternative_id: alternativeId })
                .getList()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            if (comments.length === 0) {
                commentsContainer.innerHTML = `
                    <div class="no-comments">
                        <p>No comments yet. Be the first to comment!</p>
                    </div>
                `;
                return;
            }
            
            commentsContainer.innerHTML = '';
            
            comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';
                
                const date = new Date(comment.created_at);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                commentEl.innerHTML = `
                    <div class="comment-header">
                        <div class="comment-user">
                            <div class="user-avatar">
                                <img src="https://images.websim.ai/avatar/${comment.username}" alt="${comment.username}">
                            </div>
                            <span>${comment.username}</span>
                        </div>
                        <div class="comment-rating">${comment.rating}/10</div>
                    </div>
                    <div class="comment-text">${comment.comment}</div>
                    <div class="comment-date">${formattedDate}</div>
                `;
                
                commentsContainer.appendChild(commentEl);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsContainer.innerHTML = `
                <div class="no-comments">
                    <p>Failed to load comments. Please try again.</p>
                </div>
            `;
        }
    }

    async function getAlternativeById(id) {
        try {
            const alternatives = room.collection('eco_alternative').getList();
            return alternatives.find(alt => alt.id === id);
        } catch (error) {
            console.error('Error getting alternative:', error);
            return null;
        }
    }

    function showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'var(--primary-color)';
        notification.style.color = 'white';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '10px';
        notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
        notification.style.zIndex = '1000';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'all 0.3s ease';
        
        // Append to body
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});

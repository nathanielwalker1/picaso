// Page navigation functions
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
}

async function handleCreate() {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
        alert('Please enter a prompt for your artwork');
        return;
    }

    const createBtn = document.querySelector('.create-btn');
    const originalText = createBtn.textContent;
    
    // Show loading state
    createBtn.textContent = 'Creating...';
    createBtn.disabled = true;
    createBtn.style.backgroundColor = '#8B7CF8';

    try {
        // Call the image generation API
        console.log('Making API request to generate image...');
        console.log('Prompt:', prompt);
        
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });
        
        console.log('API response status:', response.status);
        console.log('API response ok:', response.ok);

        const data = await response.json();

        if (data.success) {
            // Update the featured image with the generated image
            const featuredImage = document.querySelector('.featured-image');
            featuredImage.src = data.imageUrl;
            
            // Update the checkout and confirmation pages with the same prompt and image
            document.querySelectorAll('.order-description').forEach(el => {
                el.textContent = `"${prompt}"`;
            });
            
            document.querySelectorAll('.order-image').forEach(el => {
                el.src = data.imageUrl;
            });

            // Show success feedback
            createBtn.textContent = 'Created!';
            createBtn.style.backgroundColor = '#4CAF50';
            
            // Add to recently generated (simulate)
            addToRecentlyGenerated(data.imageUrl, prompt);
            
        } else {
            throw new Error(data.error || 'Failed to generate image');
        }

    } catch (error) {
        console.error('Error generating image:', error);
        alert(`Error: ${error.message}`);
        createBtn.textContent = 'Try Again';
        createBtn.style.backgroundColor = '#ff4444';
    } finally {
        // Reset button after 3 seconds
        setTimeout(() => {
            createBtn.textContent = originalText;
            createBtn.style.backgroundColor = '#ffffff';
            createBtn.disabled = false;
        }, 3000);
    }
}

function goToCheckout() {
    showPage('stripe-checkout-page');
    
    // Copy the current artwork to Stripe checkout page
    const featuredImage = document.querySelector('.featured-image');
    const stripeOrderImage = document.querySelector('.stripe-order-image');
    stripeOrderImage.src = featuredImage.src;
    
    // Update the order description
    const currentPrompt = document.getElementById('prompt-input').value.trim();
    const orderDescription = document.querySelector('#stripe-checkout-page .order-description');
    orderDescription.textContent = `"${currentPrompt}"`;
}

function goToConfirmation() {
    // Basic form validation
    const requiredFields = document.querySelectorAll('#checkout-page .form-input');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderBottom = '2px solid #ff4444';
            isValid = false;
        } else {
            field.style.borderBottom = 'none';
        }
    });
    
    if (!isValid) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Generate order confirmation number
    const orderNumber = Math.random().toString(36).substr(2, 10).toUpperCase();
    document.querySelector('.order-number').textContent = orderNumber;
    
    // Copy artwork to confirmation page
    const checkoutImage = document.querySelector('#checkout-page .order-image');
    const confirmationImage = document.querySelector('#confirmation-page .order-image');
    confirmationImage.src = checkoutImage.src;
    
    showPage('confirmation-page');
}

// Function to add images to recently generated section
function addToRecentlyGenerated(imageUrl, prompt) {
    const gallery = document.querySelector('.gallery');
    const newItem = document.createElement('div');
    newItem.className = 'gallery-item';
    newItem.innerHTML = `
        <img src="${imageUrl}" alt="Generated artwork">
        <p>${prompt}</p>
    `;
    
    // Add click handler to use this prompt
    newItem.addEventListener('click', function() {
        document.getElementById('prompt-input').value = prompt;
        handleCreate();
    });
    
    // Add to beginning of gallery
    gallery.insertBefore(newItem, gallery.firstChild);
    
    // Keep only the 6 most recent items
    while (gallery.children.length > 6) {
        gallery.removeChild(gallery.lastChild);
    }
}

// Enhanced shuffle functionality with API
document.addEventListener('DOMContentLoaded', function() {
    const shuffleBtn = document.querySelector('.shuffle-btn');
    
    shuffleBtn.addEventListener('click', async function() {
        const currentPrompt = document.getElementById('prompt-input').value.trim();
        
        if (currentPrompt) {
            // Generate variation of current prompt
            try {
                shuffleBtn.textContent = 'Shuffling...';
                shuffleBtn.disabled = true;
                
                const response = await fetch('/api/generate-variation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ basePrompt: currentPrompt })
                });

                const data = await response.json();

                if (data.success) {
                    // Update the featured image and prompt
                    const featuredImage = document.querySelector('.featured-image');
                    featuredImage.src = data.imageUrl;
                    document.getElementById('prompt-input').value = data.prompt;
                    
                    // Update other pages
                    document.querySelectorAll('.order-description').forEach(el => {
                        el.textContent = `"${data.prompt}"`;
                    });
                    
                    document.querySelectorAll('.order-image').forEach(el => {
                        el.src = data.imageUrl;
                    });
                    
                    addToRecentlyGenerated(data.imageUrl, data.prompt);
                }
            } catch (error) {
                console.error('Error shuffling:', error);
                alert('Failed to generate variation');
            } finally {
                shuffleBtn.textContent = 'Shuffle';
                shuffleBtn.disabled = false;
            }
        } else {
            // Use random prompts if no current prompt
            const prompts = [
                'abstract geometric patterns in vibrant colors',
                'serene mountain landscape at sunset',
                'futuristic cityscape with neon lights',
                'peaceful garden with blooming flowers',
                'cosmic nebula with swirling galaxies',
                'vintage coffee shop on a rainy day'
            ];
            
            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
            document.getElementById('prompt-input').value = randomPrompt;
            handleCreate();
        }
    });
    
    // Add gallery item click handlers
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', function() {
            const description = this.querySelector('p').textContent;
            document.getElementById('prompt-input').value = description;
            handleCreate();
        });
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.id === 'prompt-input') {
            handleCreate();
        }
        
        if (e.key === 'Escape') {
            showPage('main-page');
        }
    });
});

// Stripe checkout functionality
async function handleStripeCheckout() {
    const featuredImage = document.querySelector('.featured-image');
    const currentPrompt = document.getElementById('prompt-input').value.trim();
    
    if (!featuredImage.src || !currentPrompt) {
        alert('Please generate an artwork first');
        return;
    }

    const checkoutBtn = document.getElementById('stripe-checkout-btn');
    const originalText = checkoutBtn.innerHTML;
    
    try {
        checkoutBtn.innerHTML = '<span>⏳</span> Creating Checkout...';
        checkoutBtn.disabled = true;

        const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageUrl: featuredImage.src,
                prompt: currentPrompt
            })
        });

        const data = await response.json();

        if (data.url) {
            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Failed to create checkout session');
        }

    } catch (error) {
        console.error('Error creating checkout:', error);
        alert(`Error: ${error.message}`);
        checkoutBtn.innerHTML = originalText;
        checkoutBtn.disabled = false;
    }
}

// Add some smooth animations
function addLoadingAnimation(button) {
    const originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;
    
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
}

// Auto-save form data to localStorage
function saveFormData() {
    const formInputs = document.querySelectorAll('#checkout-page .form-input');
    const formData = {};
    
    formInputs.forEach(input => {
        if (input.placeholder) {
            formData[input.placeholder] = input.value;
        }
    });
    
    localStorage.setItem('picasoFormData', JSON.stringify(formData));
}

function loadFormData() {
    const savedData = localStorage.getItem('picasoFormData');
    if (savedData) {
        const formData = JSON.parse(savedData);
        const formInputs = document.querySelectorAll('#checkout-page .form-input');
        
        formInputs.forEach(input => {
            if (input.placeholder && formData[input.placeholder]) {
                input.value = formData[input.placeholder];
            }
        });
    }
}

// Load saved form data when page loads
document.addEventListener('DOMContentLoaded', loadFormData);

// Save form data when inputs change
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('form-input')) {
        saveFormData();
    }
});

// Add Stripe checkout button event listener
document.addEventListener('DOMContentLoaded', function() {
    const stripeCheckoutBtn = document.getElementById('stripe-checkout-btn');
    if (stripeCheckoutBtn) {
        stripeCheckoutBtn.addEventListener('click', handleStripeCheckout);
    }
});
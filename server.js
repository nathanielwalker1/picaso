require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for image generation
app.post('/api/generate-image', async (req, res) => {
    console.log('Received generate-image request');
    try {
        const { prompt } = req.body;
        console.log('Request body:', req.body);
        
        if (!prompt) {
            console.log('No prompt provided');
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('Generating image for prompt:', prompt);

        // Generate image using OpenAI DALL-E
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });

        const imageUrl = response.data[0].url;
        
        res.json({ 
            success: true, 
            imageUrl: imageUrl,
            prompt: prompt
        });

    } catch (error) {
        console.error('Error generating image:', error);
        
        // Handle specific OpenAI errors
        if (error.status === 429) {
            res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        } else if (error.status === 400) {
            res.status(400).json({ error: 'Invalid prompt. Please try a different description.' });
        } else {
            res.status(500).json({ error: 'Failed to generate image. Please try again.' });
        }
    }
});

// API endpoint for image variations (shuffle feature)
app.post('/api/generate-variation', async (req, res) => {
    try {
        const { basePrompt } = req.body;
        
        const variations = [
            'with different lighting',
            'from a different angle', 
            'with more detail',
            'in a different composition',
            'with varied colors',
            'with different mood'
        ];
        
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const enhancedPrompt = `${basePrompt}, ${randomVariation}`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });

        res.json({ 
            success: true, 
            imageUrl: response.data[0].url,
            prompt: enhancedPrompt
        });

    } catch (error) {
        console.error('Error generating variation:', error);
        res.status(500).json({ error: 'Failed to generate variation' });
    }
});

// Stripe checkout endpoint
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { imageUrl, prompt } = req.body;
        
        console.log('Creating Stripe checkout session for:', prompt);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'PICASO Custom Artwork Print',
                            description: `"${prompt}" - 12x12 Matte Canvas with Stretcher Bar`,
                            images: [imageUrl],
                        },
                        unit_amount: 4999, // $49.99 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/`,
            metadata: {
                prompt: prompt,
                imageUrl: imageUrl
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Success page endpoint
app.get('/success', async (req, res) => {
    try {
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        // You can access the metadata here
        const { prompt, imageUrl } = session.metadata;
        
        // Send success page HTML
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Successful - PICASO</title>
                <link rel="stylesheet" href="styles.css">
            </head>
            <body>
                <div class="app">
                    <div class="page active">
                        <header>
                            <h1 class="page-title">🎉 PAYMENT SUCCESSFUL!</h1>
                            <p class="order-description">"${prompt}"</p>
                        </header>
                        <div class="confirmation-content">
                            <div class="order-preview">
                                <img src="${imageUrl}" alt="Your Artwork" class="order-image">
                                <p class="artwork-label">[your artwork]</p>
                            </div>
                            <div class="confirmation-details">
                                <p class="confirmation-message">Your order is confirmed! You'll receive an email with tracking details soon.</p>
                                <div class="order-info">
                                    <p>Order ID: ${sessionId}</p>
                                    <p>Amount: $49.99</p>
                                </div>
                                <div class="contact-info">
                                    <p>For enquiries:</p>
                                    <p>picaso@terranova.com</p>
                                </div>
                                <br>
                                <button onclick="window.location.href='/'" class="submit-btn">Create Another Artwork</button>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error retrieving session:', error);
        res.redirect('/');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🎨 PICASO server running at http://localhost:${PORT}`);
    console.log('🤖 OpenAI integration ready');
    console.log('💳 Stripe payments ready');
    console.log('Press Ctrl+C to stop the server');
});
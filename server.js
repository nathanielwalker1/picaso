require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const Stripe = require('stripe');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Printful API configuration
const PRINTFUL_API_BASE = 'https://api.printful.com';
const printfulHeaders = {
    'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json'
};

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

// Printful order creation function
async function createPrintfulOrder(imageUrl, prompt, customerInfo, sessionId) {
    try {
        console.log('Creating Printful order for:', prompt);

        // Step 1: Upload image to Printful
        const uploadResponse = await axios.post(`${PRINTFUL_API_BASE}/files`, {
            type: 'default',
            url: imageUrl
        }, { headers: printfulHeaders });

        const fileId = uploadResponse.data.result.id;
        console.log('Image uploaded to Printful, file ID:', fileId);

        // Step 2: Create Printful order with canvas
        // Using canvas product ID (you may need to adjust based on your Printful catalog)
        const orderData = {
            recipient: {
                name: customerInfo.name || 'PICASO Customer',
                address1: customerInfo.address1 || '123 Main St',
                city: customerInfo.city || 'New York',
                state_code: customerInfo.state || 'NY',
                country_code: customerInfo.country || 'US',
                zip: customerInfo.zip || '10001'
            },
            items: [
                {
                    sync_variant_id: null, // We'll use variant_id instead
                    variant_id: 10309, // 12"×12" Canvas - this is a common Printful canvas variant
                    quantity: 1,
                    files: [
                        {
                            id: fileId,
                            type: 'default'
                        }
                    ]
                }
            ],
            external_id: sessionId // Link to Stripe session
        };

        const orderResponse = await axios.post(`${PRINTFUL_API_BASE}/orders`, orderData, { 
            headers: printfulHeaders 
        });

        console.log('Printful order created:', orderResponse.data.result.id);
        return orderResponse.data.result;

    } catch (error) {
        console.error('Error creating Printful order:', error.response?.data || error.message);
        throw error;
    }
}

// Stripe webhook endpoint for payment success
app.post('/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    // For development, we'll skip webhook signature verification
    // In production, you should verify the webhook signature
    
    try {
        const event = JSON.parse(req.body.toString());
        
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log('Payment completed for session:', session.id);
            
            // Extract customer and order info
            const { prompt, imageUrl } = session.metadata;
            
            // Get customer details from Stripe
            const customer = await stripe.customers.retrieve(session.customer);
            
            const customerInfo = {
                name: customer.name || session.customer_details?.name,
                email: customer.email || session.customer_details?.email,
                address1: session.customer_details?.address?.line1,
                city: session.customer_details?.address?.city,
                state: session.customer_details?.address?.state,
                country: session.customer_details?.address?.country,
                zip: session.customer_details?.address?.postal_code
            };

            // Create Printful order
            try {
                const printfulOrder = await createPrintfulOrder(imageUrl, prompt, customerInfo, session.id);
                console.log('✅ Printful order created successfully:', printfulOrder.id);
            } catch (error) {
                console.error('❌ Failed to create Printful order:', error.message);
                // You might want to implement retry logic or alert systems here
            }
        }
        
        res.json({received: true});
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Test Printful connection
app.get('/api/test-printful', async (req, res) => {
    try {
        const response = await axios.get(`${PRINTFUL_API_BASE}/store`, { 
            headers: printfulHeaders 
        });
        res.json({ 
            success: true, 
            store: response.data.result,
            message: 'Printful connection successful!' 
        });
    } catch (error) {
        console.error('Printful connection failed:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

// Alternative: Manual order creation endpoint (for testing)
app.post('/api/create-printful-order', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const { prompt, imageUrl } = session.metadata;
        
        // Create dummy customer info for testing
        const customerInfo = {
            name: 'Test Customer',
            address1: '123 Test Street',
            city: 'Test City', 
            state: 'NY',
            country: 'US',
            zip: '10001'
        };
        
        const printfulOrder = await createPrintfulOrder(imageUrl, prompt, customerInfo, sessionId);
        res.json({ success: true, orderId: printfulOrder.id });
        
    } catch (error) {
        console.error('Error creating manual Printful order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🎨 PICASO server running at http://localhost:${PORT}`);
    console.log('🤖 OpenAI integration ready');
    console.log('💳 Stripe payments ready');
    console.log('🖨️  Printful fulfillment ready');
    console.log('Press Ctrl+C to stop the server');
});
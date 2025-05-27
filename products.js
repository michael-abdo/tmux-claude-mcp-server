// AI Agent Products Data
const products = [
    {
        id: 1,
        name: "DataMinerPro",
        price: 299,
        description: "Automated data extraction and analysis agent that can scrape, clean, and analyze data from multiple sources",
        category: "Data Analysis",
        imageUrl: "https://via.placeholder.com/300x200"
    },
    {
        id: 2,
        name: "CustomerBot3000",
        price: 199,
        description: "24/7 AI customer service agent that handles inquiries, support tickets, and customer feedback",
        category: "Customer Service",
        imageUrl: "https://via.placeholder.com/300x200"
    },
    {
        id: 3,
        name: "ContentGenius",
        price: 149,
        description: "AI-powered content creation assistant for blogs, social media, and marketing materials",
        category: "Content Creation",
        imageUrl: "https://via.placeholder.com/300x200"
    },
    {
        id: 4,
        name: "CodeHelperAI",
        price: 399,
        description: "Programming and debugging assistant that helps write, review, and optimize code",
        category: "Development",
        imageUrl: "https://via.placeholder.com/300x200"
    },
    {
        id: 5,
        name: "SalesBoostAgent",
        price: 249,
        description: "Lead qualification and sales automation agent that nurtures prospects and closes deals",
        category: "Sales",
        imageUrl: "https://via.placeholder.com/300x200"
    },
    {
        id: 6,
        name: "ResearchBotPlus",
        price: 179,
        description: "Market research and competitive analysis agent for business intelligence",
        category: "Research",
        imageUrl: "https://via.placeholder.com/300x200"
    }
];

// Function to display products on the products page
function displayProducts() {
    const productGrid = document.getElementById('product-grid');
    
    if (!productGrid) return; // Exit if not on products page
    
    productGrid.innerHTML = ''; // Clear existing content
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <img src="${product.imageUrl}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p class="price">$${product.price}</p>
            <button onclick="viewProduct(${product.id})">View Details</button>
        `;
        productGrid.appendChild(productCard);
    });
}

// Function to navigate to product detail page
function viewProduct(productId) {
    window.location.href = `product-detail.html?id=${productId}`;
}

// Function to display product details
function displayProductDetails() {
    // Get product ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    
    // Find the product
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        window.location.href = 'products.html'; // Redirect if product not found
        return;
    }
    
    // Update page elements
    const productImage = document.getElementById('product-image');
    const productName = document.getElementById('product-name');
    const productDescription = document.getElementById('product-description');
    const productPrice = document.getElementById('product-price');
    
    if (productImage) {
        productImage.src = product.imageUrl;
        productImage.alt = product.name;
    }
    if (productName) productName.textContent = product.name;
    if (productDescription) productDescription.textContent = product.description;
    if (productPrice) productPrice.textContent = product.price;
    
    // Add to cart functionality
    const addToCartButton = document.getElementById('add-to-cart');
    if (addToCartButton) {
        addToCartButton.onclick = () => addToCart(product);
    }
}

// Function to add product to cart (basic implementation)
function addToCart(product) {
    // Get existing cart from localStorage or create new array
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // Check if product already exists in cart
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    
    // Save updated cart
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Show feedback to user
    alert(`${product.name} added to cart!`);
}

// Initialize page based on current location
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('products.html')) {
        displayProducts();
    } else if (window.location.pathname.includes('product-detail.html')) {
        displayProductDetails();
    }
});
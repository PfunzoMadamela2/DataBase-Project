const API_URL = "http://localhost:5000";

// Check server connection on page load
async function checkServerConnection() {
    const statusElement = document.getElementById('connection-status');
    
    try {
        const response = await fetch(`${API_URL}/test`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            statusElement.innerHTML = '<div class="status connected"> Connected to server! Ready to login.</div>';
            console.log(' Server is connected:', data);
            return true;
        } else {
            statusElement.innerHTML = '<div class="status error"> Server error. Please check backend.</div>';
            return false;
        }
    } catch (error) {
        statusElement.innerHTML = `
            <div class="status error">
                 Cannot connect to server at ${API_URL}
                <br><small>Please make sure the backend server is running:</small>
                <br><small>1. Open terminal in backend folder</small>
                <br><small>2. Run: npm start</small>
                <br><small>3. Check http://localhost:5000/test in your browser</small>
            </div>
        `;
        console.error(' Server connection failed:', error);
        return false;
    }
}

async function login() {
    const password = document.getElementById("password").value;
    const messageElement = document.getElementById("login-message");
    
    // Clear previous messages
    messageElement.textContent = "";
    messageElement.style.color = "";

    // Show loading
    const loginBtn = document.querySelector('.login-btn');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        
        if (data.success) {
            messageElement.textContent = " Login successful! Loading app...";
            messageElement.style.color = "green";
            
            // Wait a moment then load the full app
            setTimeout(() => {
                loadFullApp();
            }, 1000);
            
        } else {
            messageElement.textContent = " " + (data.message || "Login failed");
            messageElement.style.color = "red";
        }
    } catch (error) {
        console.error("Login error:", error);
        messageElement.innerHTML = `
             Network error<br>
            <small>Please check:</small>
            <br><small>• Backend server is running on port 5000</small>
            <br><small>• No firewall blocking the connection</small>
            <br><small>• Try refreshing the page</small>
        `;
        messageElement.style.color = "red";
    } finally {
        // Restore button
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

function loadFullApp() {
    // This would load the full application interface
    // For now, just show a success message
    document.getElementById("login-section").style.display = "none";
    document.getElementById("connection-status").innerHTML = 
        '<div class="status connected"> Successfully logged in! Full app would load here.</div>';
    
    // In a real app, you would load the full interface here
    document.getElementById("app-section").style.display = "block";
    document.getElementById("app-section").innerHTML = `
        <h2>Expense Dashboard</h2>
        <p style="text-align: center; margin: 20px 0;">
             Login successful! The full expense tracker app would load here.
        </p>
        <button onclick="logout()" style="background: #dc3545; color: white;">Logout</button>
    `;
}

function logout() {
    document.getElementById("app-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    document.getElementById("password").value = "admin123";
    document.getElementById("login-message").textContent = "";
    document.getElementById("connection-status").innerHTML = 
        '<div class="status connected"> Connected to server! Ready to login.</div>';
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log(" Expense Tracker Frontend Initialized");
    console.log(" API URL:", API_URL);
    
    // Check server connection
    checkServerConnection();
    
    // Add enter key support for login
    document.getElementById("password").addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            login();
        }
    });
});
// DOM Elements
const authContainer = document.getElementById('authContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const expenseForm = document.getElementById('expenseForm');
const logoutBtn = document.getElementById('logoutBtn');
const expenseList = document.getElementById('expenseList');
const dailyLimitInput = document.getElementById('dailyLimit');
const setLimitBtn = document.getElementById('setLimitBtn');
const limitStatus = document.getElementById('limitStatus');
const creditAmountInput = document.getElementById('creditAmount');
const setCreditBtn = document.getElementById('setCreditBtn');
const monthlyCreditDisplay = document.getElementById('monthlyCredit');
const currentExpensesDisplay = document.getElementById('currentExpenses');
const remainingBalanceDisplay = document.getElementById('remainingBalance');
const expenseProgressBar = document.getElementById('expenseProgress');
const balanceProgressBar = document.getElementById('balanceProgress');
const monthlyComparisonChartCanvas = document.getElementById('monthlyComparisonChart');
const userProfileDisplay = document.querySelector('.user-profile');
const userAvatar = document.querySelector('.user-avatar');
const userName = document.querySelector('.user-name');
const userEmail = document.querySelector('.user-email');
const monthSelector = document.getElementById('monthSelector');

// Charts
let categoryChart = null;
let dailyChart = null;
let monthlyComparisonChart = null;

// Current user and expenses data
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let expenses = [];
let dailyLimit = 0;
let monthlyCredit = parseFloat(localStorage.getItem('monthlyCredit')) || 0;

// Add new variables
let selectedMonth = new Date().getMonth();
let selectedYear = new Date().getFullYear();

// Initialize the application
function init() {
    setupEventListeners();
    setupTabNavigation();
    setupMonthSelector();
    checkAuth();
}

// Event Listeners
function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    expenseForm.addEventListener('submit', handleAddExpense);
    logoutBtn.addEventListener('click', handleLogout);
    setLimitBtn.addEventListener('click', handleSetDailyLimit);
    setCreditBtn.addEventListener('click', handleSetMonthlyCredit);
}

// Tab Navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });
}

// Authentication
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loadUserData();
        showDashboard();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // For demo purposes, we'll just store the email
    currentUser = {
        email: email,
        name: email.split('@')[0], // Using part of email as name for demo
    };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    updateUserProfile();
    showDashboard();
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    if (users.some(u => u.email === email)) {
        showNotification('Email already registered', 'error');
        return;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    showNotification('Registration successful! Please login.', 'success');
    
    // Switch to login tab
    document.querySelector('[data-tab="login"]').click();
    registerForm.reset();
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    expenses = [];
    showAuth();
    showNotification('Logged out successfully', 'success');
}

function handleSetDailyLimit() {
    const limit = parseFloat(dailyLimitInput.value);
    if (isNaN(limit) || limit < 0) {
        showNotification('Please enter a valid daily limit', 'error');
        return;
    }
    
    dailyLimit = limit;
    localStorage.setItem(`dailyLimit_${currentUser.id}`, limit);
    updateDailyLimitStatus();
    updateExpenseList(); // Update expense colors based on new limit
    showNotification('Daily limit updated successfully', 'success');
}

function updateDailyLimitStatus() {
    if (!dailyLimit) {
        limitStatus.textContent = '';
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = expenses
        .filter(exp => exp.date === today)
        .reduce((sum, exp) => sum + exp.amount, 0);

    const remaining = dailyLimit - todayExpenses;
    
    if (remaining >= 0) {
        limitStatus.textContent = `${formatCurrency(remaining)} remaining today`;
        limitStatus.className = 'daily-limit-status status-under';
    } else {
        limitStatus.textContent = `${formatCurrency(Math.abs(remaining))} over limit today`;
        limitStatus.className = 'daily-limit-status status-over';
    }
}

// Expense Management
function handleAddExpense(e) {
    e.preventDefault();
    
    const title = document.getElementById('expenseTitle').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;

    if (!title || !amount || !category || !date) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (amount <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    const expenseDate = new Date(date);
    const expenseMonth = expenseDate.getMonth();
    const expenseYear = expenseDate.getFullYear();

    const newExpense = {
        id: Date.now(),
        title,
        amount,
        category,
        date
    };

    expenses.push(newExpense);
    saveUserData();
    
    // Reset form
    e.target.reset();
    document.getElementById('expenseDate').valueAsDate = new Date();
    
    // Update month selector to include the new month if it's a future month
    updateMonthOptions();
    
    // If the expense is for the currently selected month, update the dashboard
    if (expenseMonth === selectedMonth && expenseYear === selectedYear) {
        updateDashboardForMonth();
    } else {
        // If it's for a different month, switch to that month
        selectedMonth = expenseMonth;
        selectedYear = expenseYear;
        updateMonthSelector();
        updateDashboardForMonth();
    }
    
    showNotification('Expense added successfully', 'success');
}

function deleteExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    // Find the expense to be deleted
    const expenseIndex = expenses.findIndex(exp => exp.id === expenseId);
    if (expenseIndex === -1) {
        showNotification('Expense not found', 'error');
        return;
    }
    
    // Remove the expense
    expenses.splice(expenseIndex, 1);
    saveUserData();
    
    // Refresh all displays and charts
    updateDashboardForMonth();
    showNotification('Expense deleted successfully', 'success');
}

// Dashboard Updates
function updateDashboard() {
    updateDashboardForMonth();
}

function updateExpenseList() {
    expenseList.innerHTML = '';
    const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === selectedMonth && 
               expenseDate.getFullYear() === selectedYear;
    });

    const sortedExpenses = [...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedExpenses.forEach(expense => {
        const isOverLimit = dailyLimit > 0 && 
            getDailyTotal(expense.date) > dailyLimit;
        
        const expenseElement = document.createElement('div');
        expenseElement.className = 'expense-item';
        expenseElement.innerHTML = `
            <div class="expense-info">
                <span class="expense-title">${expense.title}</span>
                <span class="expense-category">${formatCategory(expense.category)}</span>
                <span class="expense-date">${formatDate(expense.date)}</span>
            </div>
            <div class="expense-amount ${isOverLimit ? 'over-limit' : 'under-limit'}">
                ${formatCurrency(expense.amount)}
                <button onclick="deleteExpense(${expense.id})" class="delete-btn" aria-label="Delete expense">×</button>
            </div>
        `;
        expenseList.appendChild(expenseElement);
    });
}

function updateCharts() {
    try {
        updateCategoryChart();
        updateDailyChart();
        updateMonthlyComparisonChart();
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

function updateCategoryChart() {
    const categoryData = {};
    
    // Filter expenses for selected month
    const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === selectedMonth && 
               expenseDate.getFullYear() === selectedYear;
    });

    monthExpenses.forEach(exp => {
        categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.amount;
    });

    const data = {
        labels: Object.keys(categoryData).map(cat => formatCategory(cat)),
        datasets: [{
            data: Object.values(categoryData),
            backgroundColor: [
                '#818cf8', // Indigo
                '#fb7185', // Rose
                '#34d399', // Emerald
                '#fbbf24', // Amber
                '#f472b6', // Pink
                '#a78bfa', // Purple
                '#60a5fa'  // Blue
            ],
            borderWidth: 0
        }]
    };

    const ctx = document.getElementById('categoryChart');
    if (!ctx) {
        console.error('Category chart canvas not found');
        return;
    }

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            }
        }
    });
}

function updateDailyChart() {
    const dailyData = {};
    const last7Days = [];
    
    // Get the current date in the selected month
    const currentDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of selected month
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 6);

    // Generate last 7 days of the selected month
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        last7Days.push(dateString);
        dailyData[dateString] = 0;
    }

    // Calculate daily totals
    expenses.forEach(exp => {
        const expDate = new Date(exp.date);
        if (expDate.getMonth() === selectedMonth && expDate.getFullYear() === selectedYear) {
            if (dailyData.hasOwnProperty(exp.date)) {
                dailyData[exp.date] += exp.amount;
            }
        }
    });

    const ctx = document.getElementById('dailyChart');
    if (!ctx) {
        console.error('Daily chart canvas not found');
        return;
    }

    if (dailyChart) {
        dailyChart.destroy();
    }

    const data = {
        labels: last7Days.map(date => formatDate(date, 'short')),
        datasets: [{
            label: 'Daily Expenses',
            data: last7Days.map(date => dailyData[date] || 0),
            borderColor: '#818cf8',
            backgroundColor: 'rgba(129, 140, 248, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2,
            pointBackgroundColor: '#818cf8',
            pointBorderColor: '#818cf8',
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    if (dailyLimit > 0) {
        data.datasets.push({
            label: 'Daily Limit',
            data: last7Days.map(() => dailyLimit),
            borderColor: '#fb7185',
            borderDash: [5, 5],
            fill: false,
            tension: 0,
            borderWidth: 2,
            pointRadius: 0
        });
    }

    dailyChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#374151',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        },
                        callback: value => formatCurrency(value)
                    }
                }
            },
            plugins: {
                legend: {
                    display: dailyLimit > 0,
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: {
                            size: 12,
                            family: "'Inter', sans-serif"
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            }
        }
    });
}

function updateMonthlyComparisonChart(currentMonthExpenses = null, lastMonthExpenses = null) {
    if (!currentMonthExpenses || !lastMonthExpenses) {
        // Calculate expenses if not provided
        const currentMonthTotal = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === selectedMonth && 
                   expenseDate.getFullYear() === selectedYear;
        }).reduce((total, expense) => total + expense.amount, 0);

        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
        const lastMonthTotal = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate.getMonth() === prevMonth && 
                   expenseDate.getFullYear() === prevYear;
        }).reduce((total, expense) => total + expense.amount, 0);

        currentMonthExpenses = currentMonthTotal;
        lastMonthExpenses = lastMonthTotal;
    }

    const ctx = document.getElementById('monthlyComparisonChart');
    if (!ctx) {
        console.error('Monthly comparison chart canvas not found');
        return;
    }

    if (monthlyComparisonChart) {
        monthlyComparisonChart.destroy();
    }

    monthlyComparisonChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `${getMonthName(selectedMonth === 0 ? 11 : selectedMonth - 1)} Expenses`,
                `${getMonthName(selectedMonth)} Expenses`,
                'Remaining Balance'
            ],
            datasets: [{
                data: [
                    lastMonthExpenses,
                    currentMonthExpenses,
                    Math.max(monthlyCredit - currentMonthExpenses, 0)
                ],
                backgroundColor: ['#818cf8', '#34d399', '#6b7280'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e5e7eb',
                        font: {
                            size: 12,
                            family: 'Inter'
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₹${context.raw.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// Utility Functions
function loadUserData() {
    if (!currentUser) return;
    
    expenses = JSON.parse(localStorage.getItem(`expenses_${currentUser.email}`) || '[]');
    dailyLimit = parseFloat(localStorage.getItem(`dailyLimit_${currentUser.email}`)) || 0;
    monthlyCredit = parseFloat(localStorage.getItem(`monthlyCredit_${currentUser.email}`)) || 0;
    
    // Set initial values
    if (dailyLimit > 0) {
        dailyLimitInput.value = dailyLimit;
    }
    if (monthlyCredit > 0) {
        creditAmountInput.value = monthlyCredit;
    }
    
    // Set current month as default
    const currentDate = new Date();
    selectedMonth = currentDate.getMonth();
    selectedYear = currentDate.getFullYear();
    
    updateDailyLimitStatus();
    updateMonthOptions();
    updateDashboardForMonth();
}

function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem(`expenses_${currentUser.email}`, JSON.stringify(expenses));
}

function showDashboard() {
    if (!authContainer || !dashboardContainer) {
        console.error('Container elements not found');
        return;
    }
    authContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    // Set initial date in the expense form
    const dateInput = document.getElementById('expenseDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
    updateDashboard();
}

function showAuth() {
    if (!authContainer || !dashboardContainer) {
        console.error('Container elements not found');
        return;
    }
    authContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
    // Clear any forms
    loginForm.reset();
    registerForm.reset();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDate(dateString, format = 'long') {
    const date = new Date(dateString);
    if (format === 'short') {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatCategory(category) {
    const categories = {
        food: 'Food & Dining',
        transport: 'Transportation',
        utilities: 'Bills & Utilities',
        entertainment: 'Entertainment',
        shopping: 'Shopping',
        health: 'Healthcare',
        others: 'Others'
    };
    return categories[category] || category;
}

function getDailyTotal(date) {
    return expenses
        .filter(exp => exp.date === date)
        .reduce((sum, exp) => sum + exp.amount, 0);
}

function showNotification(message, type = 'info') {
    const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
    alert(`${type.toUpperCase()}: ${message}`);
}

function handleSetMonthlyCredit() {
    const amount = parseFloat(creditAmountInput.value);
    if (!amount || amount <= 0) {
        showNotification('Please enter a valid monthly credit amount', 'error');
        return;
    }
    
    monthlyCredit = amount;
    localStorage.setItem(`monthlyCredit_${currentUser.email}`, amount);
    updateMonthlyCredit();
    creditAmountInput.value = '';
    showNotification('Monthly credit updated successfully', 'success');
}

function updateMonthlyCredit() {
    // Calculate selected month's expenses
    const selectedMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === selectedMonth && 
               expenseDate.getFullYear() === selectedYear;
    }).reduce((total, expense) => total + expense.amount, 0);

    // Calculate previous month's expenses
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const prevMonthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === prevMonth && 
               expenseDate.getFullYear() === prevYear;
    }).reduce((total, expense) => total + expense.amount, 0);

    const remainingBalance = monthlyCredit - selectedMonthExpenses;
    const percentageSpent = (selectedMonthExpenses / monthlyCredit) * 100;

    // Update displays
    monthlyCreditDisplay.textContent = `₹${monthlyCredit.toFixed(2)}`;
    currentExpensesDisplay.textContent = `₹${selectedMonthExpenses.toFixed(2)}`;
    remainingBalanceDisplay.textContent = `₹${remainingBalance.toFixed(2)}`;

    // Update progress bars
    expenseProgressBar.style.width = `${Math.min(percentageSpent, 100)}%`;
    balanceProgressBar.style.width = `${Math.max(100 - percentageSpent, 0)}%`;

    // Update color based on spending
    updateProgressBarColors(percentageSpent);

    // Update comparison chart
    updateMonthlyComparisonChart(selectedMonthExpenses, prevMonthExpenses);
}

function updateProgressBarColors(percentageSpent) {
    if (percentageSpent > 90) {
        expenseProgressBar.style.backgroundColor = '#ef4444';
        currentExpensesDisplay.style.color = '#ef4444';
    } else if (percentageSpent > 75) {
        expenseProgressBar.style.backgroundColor = '#f59e0b';
        currentExpensesDisplay.style.color = '#f59e0b';
    } else {
        expenseProgressBar.style.backgroundColor = '#10b981';
        currentExpensesDisplay.style.color = '#10b981';
    }
}

function updateUserProfile() {
    if (currentUser) {
        const initials = currentUser.name.substring(0, 2);
        userAvatar.textContent = initials;
        userName.textContent = currentUser.name;
        userEmail.textContent = currentUser.email;
    }
}

// Add month selector setup
function setupMonthSelector() {
    monthSelector.addEventListener('change', handleMonthChange);
    updateMonthOptions();
}

function updateMonthOptions() {
    const months = new Set(); // Use Set to avoid duplicates
    const currentDate = new Date();
    
    // Add current month
    months.add(`${currentDate.getMonth()}-${currentDate.getFullYear()}`);
    
    // Add next month
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(currentDate.getMonth() + 1);
    months.add(`${nextMonth.getMonth()}-${nextMonth.getFullYear()}`);
    
    // Add months from expenses
    expenses.forEach(expense => {
        const expenseDate = new Date(expense.date);
        months.add(`${expenseDate.getMonth()}-${expenseDate.getFullYear()}`);
    });

    // Convert to array and sort
    const sortedMonths = Array.from(months).sort((a, b) => {
        const [monthA, yearA] = a.split('-').map(Number);
        const [monthB, yearB] = b.split('-').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
    });

    // Clear existing options
    monthSelector.innerHTML = '';

    // Add options to selector
    sortedMonths.forEach(monthYear => {
        const [month, year] = monthYear.split('-').map(Number);
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = `${getMonthName(month)} ${year}`;
        if (month === selectedMonth && year === selectedYear) {
            option.selected = true;
        }
        monthSelector.appendChild(option);
    });
}

function handleMonthChange(e) {
    const [month, year] = e.target.value.split('-').map(Number);
    
    // Reset displays before changing month
    resetDisplays();
    
    // Update selected month and year
    selectedMonth = month;
    selectedYear = year;
    
    // Update the dashboard for the new month
    updateDashboardForMonth();
}

function updateDashboardForMonth() {
    try {
        updateMonthlyCredit();
        updateExpenseList();
        updateCharts();
        updateDailyLimitStatus();
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

// Add a utility function to get month name
function getMonthName(monthIndex) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[monthIndex];
}

// Add function to update month selector value
function updateMonthSelector() {
    const monthYearValue = `${selectedMonth}-${selectedYear}`;
    if (monthSelector.value !== monthYearValue) {
        monthSelector.value = monthYearValue;
    }
}

// Add function to reset displays
function resetDisplays() {
    // Reset expense list
    expenseList.innerHTML = '';
    
    // Reset charts
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    if (dailyChart) {
        dailyChart.destroy();
        dailyChart = null;
    }
    if (monthlyComparisonChart) {
        monthlyComparisonChart.destroy();
        monthlyComparisonChart = null;
    }
    
    // Reset progress bars
    expenseProgressBar.style.width = '0%';
    balanceProgressBar.style.width = '100%';
    
    // Reset displays
    currentExpensesDisplay.textContent = '₹0';
    remainingBalanceDisplay.textContent = `₹${monthlyCredit.toFixed(2)}`;
}

// Initialize the application
init(); 
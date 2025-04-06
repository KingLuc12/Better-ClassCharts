const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const clientMiddleware = require('./middleware/clientMiddleware');

const { StudentClient } = require('classcharts-api');

require('dotenv').config()

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.redirect('/home');
});

app.get('/home', (req, res) => {
    res.sendFile('index.html', { root: 'public/home' });
});

app.get('/login', (req, res) => {
    const pupilCode = req.cookies.pupilCode;
    const dateOfBirth = req.cookies.dateOfBirth;
    
    if (pupilCode && dateOfBirth) {
        return res.redirect('/dashboard');
    }
    
    res.sendFile('index.html', { root: 'public/login' });
});

app.post('/api/verify-credentials', async (req, res) => {
    try {
        const { pupilCode, dateOfBirth } = req.body;
        
        if (!pupilCode || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Pupil code and date of birth are required'
            });
        }
        
        try {
            const client = new StudentClient(pupilCode, dateOfBirth);
            await client.login();
            
            return res.json({
                success: true,
                message: 'Credentials verified successfully'
            });
        } catch (error) {
            console.error('Credential verification error:', error);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Please check your pupil code and date of birth.'
            });
        }
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
});

app.use(clientMiddleware);

function getLastAugust() {
    const now = new Date();
    const currentYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const date = new Date(currentYear, 7, 1);
    return date.toISOString().split('T')[0];
}

app.get('/dashboard', (req, res) => {
    res.sendFile('index.html', { root: 'public/dashboard' });
});

app.get('/dashboard/attendance', (req, res) => {
    res.sendFile('index.html', { root: 'public/dashboard/attendance' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('pupilCode');
    res.clearCookie('dateOfBirth');
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

app.get('/api/user', async (req, res) => {
    try {
        const profile = await req.client.getStudentInfo();
        
        res.json({
            success: true,
            user: {
                name: profile.data.user.name || 'Student',
                displayName: profile.data.user.first_name || 'Student',
                avatar: profile.data.user.avatar_url || null
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch user data'
        });
    }
});

app.get('/api/getAttendance', async (req, res) => {
    try {
        const client = req.client;
        const lastAugust = getLastAugust();
        
        const attendance = await client.getAttendance({
            from: lastAugust,
            to: new Date().toISOString().split('T')[0]
        });

        if (!attendance) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch attendance data'
            });
        }
        
        res.json(attendance);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch attendance data'
        });
    }
});

app.get('/api/getBehaviour', async (req, res) => {
    try {
        const client = req.client;
        const fromDate = req.query.from || getLastAugust();
        const toDate = req.query.to || new Date().toISOString().split('T')[0];
        
        const behaviour = await client.getBehaviour({
            from: fromDate,
            to: toDate
        });

        if (!behaviour) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch behaviour data'
            });
        }
        
        res.json(behaviour);
    } catch (error) {
        console.error('Error fetching behaviour:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch behaviour data'
        });
    }
});

app.get('/api/getAnnouncements', async (req, res) => {
    try {
        const client = req.client;
        const announcements = await client.getAnnouncements();

        if (!announcements) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch announcements data'
            });
        }

        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements data'
        });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        success: false,
        message: 'Server error occurred'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

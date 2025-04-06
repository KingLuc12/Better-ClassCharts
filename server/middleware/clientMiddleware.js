const { StudentClient } = require('classcharts-api');

async function clientMiddleware(req, res, next) {
    try {
        const pupilCode = req.cookies.pupilCode;
        const dateOfBirth = req.cookies.dateOfBirth;
        
        if (!pupilCode || !dateOfBirth) {
            return res.redirect('/login');
        }
        
        try {
            const client = new StudentClient(pupilCode, dateOfBirth);
            await client.login();
            
            req.client = client;
            
            next();
        } catch (error) {
            console.error('ClassCharts login error:', error);
            
            res.clearCookie('pupilCode');
            res.clearCookie('dateOfBirth');
            
            return res.redirect('/login?error=invalid_credentials');
        }
    } catch (error) {
        console.error('Client middleware error:', error);
        res.redirect('/login?error=server_error');
    }
}

module.exports = clientMiddleware;

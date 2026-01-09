import React, { useState } from 'react';
import { Container, Box, Typography, TextField, Button, Grid, Paper } from '@mui/material';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onSubmit = (e) => { e.preventDefault(); setSent(true); };

  return (
    <Box sx={{ py: 6 }}>
      <Container maxWidth="md">
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>Contact Us</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Questions, feedback, or partnerships — we’d love to hear from you.</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              {sent ? (
                <Typography variant="subtitle1">Thanks! We’ll get back to you soon.</Typography>
              ) : (
                <form onSubmit={onSubmit}>
                  <TextField label="Name" name="name" value={form.name} onChange={onChange} fullWidth sx={{ mb: 2 }} />
                  <TextField label="Email" name="email" type="email" value={form.email} onChange={onChange} fullWidth sx={{ mb: 2 }} />
                  <TextField label="Message" name="message" value={form.message} onChange={onChange} fullWidth multiline rows={4} sx={{ mb: 2 }} />
                  <Button type="submit" variant="contained">Send</Button>
                </form>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Contact Details</Typography>
              <Typography variant="body2">Email: hello@automaticapis.dev</Typography>
              <Typography variant="body2">Support: support@automaticapis.dev</Typography>
              <Typography variant="body2">Address: Remote-first</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Contact;

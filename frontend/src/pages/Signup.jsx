import React, { useEffect, useState } from 'react';
import { Container, Paper, Typography, TextField, Button, Stack, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getPlans } from '../services/auth';

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('free');
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try { setPlans(await getPlans()); } catch {}
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signup(name, email, password, plan);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Sign Up</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <FormControl>
              <InputLabel id="plan-label">Plan</InputLabel>
              <Select labelId="plan-label" label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {plans.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name} {p.priceMonthly ? `- $${p.priceMonthly}/mo` : ''}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" type="submit" disabled={loading}>{loading ? 'Signing up…' : 'Create Account'}</Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
};

export default Signup;

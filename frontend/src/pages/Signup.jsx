import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Signup({ setToken, setCurrentUser, setActiveRole }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'supplier',
    // optional fields for supplier/distributor
    preferred_market_id: '',
    farm_location: '',
    primary_crop_types: '',
    market_id: '',
    business_name: '',
    stall_number: '',
    business_description: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        // Auto‑login after successful registration
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password })
        });
        const loginData = await loginRes.json();
        if (loginData.success) {
          setToken(loginData.token);
          setCurrentUser(loginData.user);
          setActiveRole(loginData.user.role);
          localStorage.setItem('mm_token', loginData.token);
          navigate('/dashboard');
        } else {
          setError(loginData.message || 'Login failed after registration');
        }
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">Sign Up</h2>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Full Name</label>
          <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block mb-1">Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block mb-1">Phone Number</label>
          <input type="text" name="phone_number" value={form.phone_number} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block mb-1">Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block mb-1">Role</label>
          <select name="role" value={form.role} onChange={handleChange} className="w-full border px-2 py-1 rounded">
            <option value="supplier">Supplier</option>
            <option value="distributor">Distributor</option>
          </select>
        </div>
        {/* Additional fields could be conditionally rendered per role – omitted for brevity */}
        <button type="submit" className="w-full bg-agri-dark text-white py-2 rounded hover:bg-agri-light">Create Account</button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{' '}
        <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline">Log in</button>
      </p>
    </div>
  );
}

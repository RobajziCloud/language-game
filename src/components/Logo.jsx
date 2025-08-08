import React from 'react';

const Logo = () => {
  return (
    <h1 style={{
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#ffffff',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      alignItems: 'center',
    }}>
      Lang Trainer<span style={{ color: '#22c55e' }}>.</span>
    </h1>
  );
};

export default Logo;

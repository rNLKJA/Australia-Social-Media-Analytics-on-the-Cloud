import React from 'react';
import { Button } from '@mui/material';
import { IoIosRocket } from 'react-icons/io';

function App() {
  return (
    <div className="bg-blue-500 min-h-screen flex items-center justify-center">
      <div className="text-white text-center">
        <h1 className="text-4xl mb-6">Team 57 Frontend App</h1>
        <IoIosRocket className="text-6xl mb-6" />
        <Button variant="contained" color="secondary">
          Click me
        </Button>
      </div>
    </div>
  );
}

export default App;

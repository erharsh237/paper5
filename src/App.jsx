import { useState } from 'react'
import './App.css'
import 'slick-carousel/slick/slick.css'; 
import 'slick-carousel/slick/slick-theme.css';

import HeroSection from './components/HeroSection'
import HowItWorks from './components/HowItWorks'
import ServicesOffered from './components/ServicesOffered'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <HeroSection />,
        <HowItWorks />,
        <ServicesOffered />,
      </div>
    </>
  )
}

export default App

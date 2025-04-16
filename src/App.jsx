import { useState } from 'react'
import './App.css'
import HeroSection from './components/HeroSection'
import HowItWorks from './components/HowItWorks'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <HeroSection />,
        <HowItWorks />,
      </div>
    </>
  )
}

export default App

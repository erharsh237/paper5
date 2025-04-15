import { useState } from 'react'
import './App.css'
import Navbar from './components/navbar.jsx'
import Carousel from './components/Carousel.jsx'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <Navbar />,
        <Carousel />
      </div>
    </>
  )
}

export default App

import { useState } from 'react'
import './App.css'
import Navbar from './components/navbar.jsx'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <Navbar />
      </div>
    </>
  )
}

export default App

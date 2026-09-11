import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './app.css'

function App() {
  return <RouterProvider router={router} />
}

export default App

import { Route, Routes } from 'react-router-dom'
import { AdminProvider } from '@/lib/adminAuth'
import Home from '@/pages/Home'
import Login from '@/pages/admin/Login'
import AdminLayout from '@/pages/admin/AdminLayout'
import Dashboard from '@/pages/admin/Dashboard'
import Orders from '@/pages/admin/Orders'

// Rotas públicas entram nas próximas etapas: /cardapio, /checkout, /pedido/:token
export default function App() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pedidos" element={<Orders />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
    </AdminProvider>
  )
}

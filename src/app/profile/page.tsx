'use client';

import { User, Settings, Bell, Moon, HelpCircle, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const menuItems = [
    { icon: Settings, label: 'Paramètres', description: 'Préférences et configuration' },
    { icon: Bell, label: 'Notifications', description: 'Gérer les alertes' },
    { icon: Moon, label: 'Thème sombre', description: 'Basculer le mode sombre' },
    { icon: HelpCircle, label: 'Aide', description: 'FAQ et support' },
  ];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Coureur anonyme
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                RunTrack Pro
              </p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                index !== 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
              }`}
            >
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-white">
                  {item.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <button className="w-full mt-6 flex items-center justify-center gap-2 p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Déconnexion</span>
        </button>

        {/* Version */}
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
          RunTrack Pro v1.0.0
        </p>
      </div>
    </main>
  );
}

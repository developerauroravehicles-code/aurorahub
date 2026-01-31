'use client'

import { useState } from 'react'
import React from 'react'
import { AdminTabsContent } from './admin-tabs-content'

export function AdminForms({ dealers, profiles, cameras, errors }: { dealers: any[], profiles: any[], cameras?: any[], errors: any }) {
  const [activeTab, setActiveTab] = useState<'user' | 'dealer' | 'database' | 'api' | 'logo' | 'camera'>('user')

  return (
    <div>
      <div className="flex space-x-4 mb-8 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('user')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'user'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          User
        </button>
        <button
          onClick={() => setActiveTab('dealer')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'dealer'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Dealer
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'database'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Database Management
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'api'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          API Management
        </button>
        <button
          onClick={() => setActiveTab('logo')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'logo'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Logo Management
        </button>
        <button
          onClick={() => setActiveTab('camera')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'camera'
              ? 'border-b-2 border-[#C27E00] text-[#C27E00]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Camera Models
        </button>
      </div>

      <AdminTabsContent activeTab={activeTab} dealers={dealers} profiles={profiles} cameras={cameras} errors={errors} />
    </div>
  )
}

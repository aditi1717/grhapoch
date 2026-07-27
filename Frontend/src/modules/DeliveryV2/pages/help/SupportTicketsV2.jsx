import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Clock, CheckCircle, 
  XCircle, Loader2, Eye, MessageSquare, ChevronRight, AlertTriangle
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * SupportTicketsV2 - Restored Old UI for Support Ticket Hub.
 */
export const SupportTicketsV2 = () => {
  const navigate = useNavigate();
  const goBack = useDeliveryBackNavigation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getSupportTickets();
        if (response?.data?.success) {
          setTickets(response.data.data.tickets || []);
        }
      } catch (error) {
        toast.error("Failed to load tickets");
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open": return "bg-orange-50 text-orange-600 border-orange-100";
      case "in_progress": return "bg-blue-50 text-blue-600 border-blue-100";
      case "resolved": return "bg-green-50 text-green-600 border-green-100";
      default: return "bg-gray-50 text-gray-600 border-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-white font-poppins pb-16">
       {/* Header */}
       <div className="bg-white px-4 py-2.5 pt-4 flex items-center gap-2.5 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
         <button onClick={goBack} className="p-2 hover:bg-gray-50 border border-gray-100 shadow-sm rounded-xl transition-all active:scale-95">
            <ArrowLeft className="w-4.5 h-4.5 text-gray-950" />
         </button>
         <h1 className="text-base font-black text-gray-950 leading-none">Support Tickets</h1>
      </div>

      <div className="pt-20 px-4 space-y-3.5 max-w-lg mx-auto">
        {/* Create Action */}
        <button 
          onClick={() => navigate("/food/delivery/help/tickets/create")}
          className="w-full text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(var(--module-theme-rgb, 0,183,97), 0.88), var(--module-theme-color, #00B761))",
            boxShadow: "0 4px 12px rgba(var(--module-theme-rgb, 0,183,97), 0.20)",
          }}
        >
          <Plus className="w-4 h-4" />
          Raise New Ticket
        </button>

        {/* List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
             <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Syncing Tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-200" />
             </div>
             <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest">No Active Tickets</h3>
             <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Create a ticket if you need assistance</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tickets.map((ticket, idx) => (
              <div 
                key={ticket._id || idx}
                onClick={() => navigate(`/food/delivery/help/tickets/${ticket._id}`)}
                className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden group"
              >
                <div className="flex justify-between items-start mb-2.5">
                   <div className="flex-1 pr-4">
                      <div className="flex items-center gap-1.5 mb-0.5">
                         <h4 className="text-xs font-black text-gray-950 group-hover:text-blue-600 transition-colors uppercase tracking-tight line-clamp-1">{ticket.subject}</h4>
                         {ticket.ticketId && <span className="text-[8px] font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded">#{ticket.ticketId}</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium line-clamp-1">{ticket.description}</p>
                   </div>
                   <ChevronRight className="w-4 h-4 text-gray-200" />
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                   <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusColor(ticket.status)}`}>
                        {ticket.status?.replace('_', ' ')}
                      </span>
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{ticket.category}</span>
                   </div>
                   <span className="text-[8px] font-bold text-gray-300">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

  );
};

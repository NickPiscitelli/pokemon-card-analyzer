import React, { useState, useEffect } from 'react';
import { getCardHistory, deleteCard, clearCardHistory, AnalyzedCard } from '~/utils/storage';
import { TrashIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface CardHistoryProps {
  onSelect: (card: AnalyzedCard) => void;
}

export default function CardHistory({ onSelect }: CardHistoryProps) {
  const [cards, setCards] = useState<AnalyzedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadCardHistory();
  }, []);
  
  const loadCardHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const history = await getCardHistory();
      setCards(history);
    } catch (error) {
      console.error('Failed to load card history:', error);
      setError('Failed to load card history. Please try again.');
    }
    
    setLoading(false);
  };
  
  const handleDeleteCard = async (cardId: string, event: React.MouseEvent) => {
    // Prevent the card selection when clicking the delete button
    event.stopPropagation();
    
    try {
      await deleteCard(cardId);
      // Update the local state to remove the deleted card
      setCards(cards.filter(card => card.id !== cardId));
    } catch (error) {
      console.error('Failed to delete card:', error);
      setError('Failed to delete card. Please try again.');
    }
  };
  
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      return;
    }
    
    try {
      await clearCardHistory();
      setCards([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
      setError('Failed to clear history. Please try again.');
    }
  };
  
  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Get centering score color class
  const getCenteringColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Card History</h2>
        <div className="flex gap-2">
          <button
            onClick={loadCardHistory}
            className="p-2 text-gray-600 hover:text-gray-800"
            title="Refresh History"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleClearHistory}
            disabled={cards.length === 0}
            className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400"
            title="Clear All History"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No cards in history yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Analyzed cards will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <div
              key={card.id}
              onClick={() => onSelect(card)}
              className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-shadow bg-white"
            >
              <div className="aspect-[4/5] overflow-hidden relative">
                <img
                  src={card.imageUrl}
                  alt="Card"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => handleDeleteCard(card.id, e)}
                  className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700"
                  title="Delete card"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <div
                  className={`absolute bottom-0 left-0 right-0 px-3 py-1 ${getCenteringColor(card.measurements.overallCentering)}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">Overall Centering</span>
                    <span className="text-xs font-bold">{card.measurements.overallCentering.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-500 mb-1">{formatDate(card.timestamp)}</p>
                <p className="text-sm font-medium truncate">{card.potentialGrade}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
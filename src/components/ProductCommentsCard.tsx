import { ProductComment } from '../lib/products/ProductComment';
import React from 'react';

interface ProductCommentsCardProps {
  comments: ProductComment[];
}

export function ProductCommentsCard({ comments }: ProductCommentsCardProps) {
  if (!comments?.length) return null;
  return (
    <section className="mt-12">
      <h3 className="font-bold text-2xl mb-6 text-gray-800">Comentários</h3>
      <div className="flex flex-col gap-6">
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border bg-white shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-1">
              {c.profilePicture && (
                <img
                  src={c.profilePicture}
                  alt={c.name}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow"
                />
              )}
              <div className="flex flex-col justify-center">
                <div className="text-base font-thin text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.role}</div>
              </div>
            </div>
            <div
              className="text-sm text-gray-700 mt-1"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontStyle: 'italic', fontWeight: 100 }}
            >
              {c.comment}
            </div>
            <div className="text-xs text-gray-400 mt-1">{c.date ? new Date(c.date).toLocaleDateString() : ''}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

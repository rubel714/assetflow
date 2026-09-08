import React from "react";

export default function GridActionsCell(params) {
  const row = params?.data;
  const onEdit = params?.context?.onEdit;
  const onDelete = params?.context?.onDelete;
  if (!row) return null;
  return (
    <div className="flex justify-end items-center gap-2 h-full pr-2">
      {onEdit && (
      <button
        type="button"
        className="p-2 rounded-lg hover:bg-white/10 text-accent"
        title="Edit"
        aria-label="Edit"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit?.(row);
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L8.582 18.07a4.5 4.5 0 01-1.897 1.13L4 20l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM16.862 4.487L19.5 7.125"
          />
        </svg>
      </button>
      )}
      {onDelete && (
      <button
        type="button"
        className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
        title="Delete"
        aria-label="Delete"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(row);
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9M4.772 5.176l.804 14.473a2.25 2.25 0 002.244 2.077h8.36a2.25 2.25 0 002.244-2.077l.804-14.473M8.25 5.176V4.125A1.875 1.875 0 0110.125 2.25h3.75A1.875 1.875 0 0115.75 4.125v1.051M3 5.176h18"
          />
        </svg>
      </button>
      )}
    </div>
  );
}

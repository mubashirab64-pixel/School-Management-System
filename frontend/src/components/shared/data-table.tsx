import React from 'react';
import { Edit, Eye, MoreVertical, Trash2, Square, CheckSquare } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";

interface DataTableColumn {
  key: string;
  label: string;
  render?: (item: any) => React.ReactNode;
  icon?: React.ReactNode;
  showOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn[];
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowView?: boolean;
  deleteLabel?: string;
  // Selection
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
}

export function DataTable<T extends { id: number }>({
  data,
  columns,
  onView,
  onEdit,
  onDelete,
  onRowClick,
  isLoading = false,
  emptyMessage = "No data available",
  allowEdit = true,
  allowDelete = true,
  allowView = true,
  deleteLabel = "Delete",
  selectedIds = [],
  onSelectionChange
}: DataTableProps<T>) {

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(item => item.id));
    }
  };

  const toggleOne = (id: number) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden w-full border border-gray-100">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden w-full max-w-full border border-gray-100">
      {/* Mobile Card View — compact, professional */}
      <div className="block sm:hidden space-y-2.5 p-2">
        {data.map((item) => {
          // Pull out any custom "actions" column so it sits at the card's top-right
          // (instead of being rendered as a labeled cell inside the grid).
          const actionsCol = columns.find((c) => c.key === 'actions');
          const dataCols = columns.filter((c) => c.key !== 'actions');
          const [primary, ...rest] = dataCols;
          return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl shadow-sm p-3 transition-colors ${(onRowClick ?? onView) ? 'cursor-pointer hover:border-[#6096ba]/30 hover:shadow-md' : ''} ${selectedIds.includes(item.id) ? 'border-[#2F6B8A]/40 bg-[#f4f7ff]' : 'border-gray-100'}`}
              onClick={() => (onRowClick ?? onView)?.(item)}
            >
              {/* Header: checkbox + identity + actions */}
              <div className="flex items-start gap-2.5">
                {onSelectionChange && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleOne(item.id); }}
                    className="mt-0.5 text-[#6096ba] flex-shrink-0"
                  >
                    {selectedIds.includes(item.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {primary?.render ? primary.render(item) : String((item as any)[primary?.key] ?? '')}
                </div>
                {actionsCol ? (
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {actionsCol.render ? actionsCol.render(item) : null}
                  </div>
                ) : (onView || onEdit || onDelete) && (
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        title="More"
                        onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {allowView && onView && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(item); }}>
                          <Eye className="mr-2 h-4 w-4 text-blue-600" />
                          <span>View Profile</span>
                        </DropdownMenuItem>
                      )}
                      {allowEdit && onEdit && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                          <Edit className="mr-2 h-4 w-4 text-green-600" />
                          <span>Edit Profile</span>
                        </DropdownMenuItem>
                      )}
                      {allowDelete && onDelete && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>{deleteLabel}</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Remaining columns — compact grid */}
              {rest.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {rest.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        {column.label}
                      </div>
                      <div className="text-sm text-gray-900 break-words" style={{ overflowWrap: 'anywhere' }}>
                        {column.render
                          ? column.render(item)
                          : String((item as any)[column.key] ?? '-')
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
              {onSelectionChange && (
                <TableHead className="w-10 px-3 py-3 text-[#6096ba]">
                  <button onClick={toggleAll} className="p-1 hover:bg-gray-200/60 rounded transition-colors" title="Select All">
                    {selectedIds.length === data.length && data.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{ minWidth: '120px' }}
                >
                  <div className="flex items-center space-x-2">
                    {column.icon && <span className="h-4 w-4 text-gray-400">{column.icon}</span>}
                    <span>{column.label}</span>
                  </div>
                </TableHead>
              ))}
              {(onView || onEdit || onDelete) && (
                <TableHead className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center space-x-2">
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                    <span>Actions</span>
                  </div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id} className={`hover:bg-gray-50/70 text-gray-900 transition-colors ${(onRowClick ?? onView) ? 'cursor-pointer' : ''} ${selectedIds.includes(item.id) ? 'bg-[#f4f7ff]' : ''}`}
                onClick={() => (onRowClick ?? onView)?.(item)}>
                {onSelectionChange && (
                  <TableCell className="w-10 px-3 py-3">
                    <button onClick={() => toggleOne(item.id)} className="p-1 hover:bg-gray-100 rounded transition-colors text-[#6096ba]">
                      {selectedIds.includes(item.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                    </button>
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className="px-3 py-3 whitespace-nowrap text-sm text-gray-900"
                  >
                    {column.render
                      ? column.render(item)
                      : String(item[column.key as keyof T] || '-')
                    }
                  </TableCell>
                ))}
                {(onView || onEdit || onDelete) && (
                  <TableCell className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            title="More"
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {allowView && onView && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(item); }}>
                              <Eye className="mr-2 h-4 w-4 text-blue-600" />
                              <span>View Profile</span>
                            </DropdownMenuItem>
                          )}
                          {allowEdit && onEdit && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                              <Edit className="mr-2 h-4 w-4 text-green-600" />
                              <span>Edit Profile</span>
                            </DropdownMenuItem>
                          )}
                          {allowDelete && onDelete && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>{deleteLabel}</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

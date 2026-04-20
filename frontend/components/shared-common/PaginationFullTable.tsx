import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  isLoading: boolean;
  data: object[];
  filter: {
    page?: number;
  };
  setFilter: React.Dispatch<React.SetStateAction<any>>;
}

const PaginationFullTable = ({ isLoading, data, filter, setFilter }: Props) => {
  return !isLoading && data?.length > 0 ? (
    <div className="flex items-center justify-between mt-3 bg-white rounded-lg border border-gray-200 p-4">
      <button
        onClick={() => {
          if (filter.page > 1) {
            setFilter((prev) => ({
              ...prev,
              page: prev.page - 1,
            }));
          }
        }}
        disabled={filter.page === 1}
        className="btn btn-primary w-40 disabled:btn-disabled"
      >
        <ArrowLeft size={16} className="mr-1" />
        Previous
      </button>
      <span className="text-lg font-bold text-gray-700">
        Halaman {filter.page}
      </span>
      <button
        onClick={() => {
          setFilter((prev) => ({
            ...prev,
            page: (prev.page || 1) + 1,
          }));
        }}
        disabled={data.length < 10}
        className="btn btn-primary w-40 disabled:btn-disabled"
      >
        Next
        <ArrowRight size={16} className="ml-1" />
      </button>
    </div>
  ) : null;
};

export default PaginationFullTable;

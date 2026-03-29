interface BoardProps {
  board: number[]
  disabled: boolean
  onCellClick: (position: number) => void
}

export default function Board({ board, disabled, onCellClick }: BoardProps) {
  return (
    <div className="w-fit mx-auto bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4">
      <div className="grid grid-cols-3">
        {board.map((cell, i) => {
          const isEmpty = cell === 0
          const isClickable = !disabled && isEmpty
          const col = i % 3
          const row = Math.floor(i / 3)

          return (
            <button
              key={i}
              onClick={() => onCellClick(i)}
              disabled={disabled || !isEmpty}
              className={`
                w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl font-semibold
                flex items-center justify-center
                transition-colors duration-100
                ${col < 2 ? "border-r-2 border-r-gray-200" : ""}
                ${row < 2 ? "border-b-2 border-b-gray-200" : ""}
                ${isClickable ? "hover:bg-indigo-50 cursor-pointer" : ""}
                ${cell === 1 ? "text-indigo-600" : ""}
                ${cell === 2 ? "text-rose-500" : ""}
              `}
            >
              {cell === 1 ? "X" : cell === 2 ? "O" : ""}
            </button>
          )
        })}
      </div>
    </div>
  )
}

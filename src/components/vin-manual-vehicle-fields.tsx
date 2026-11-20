type VinManualVehicleFieldsProps = {
  vehicleYear: string
  vehicleMake: string
  vehicleModel: string
  onVehicleYear: (v: string) => void
  onVehicleMake: (v: string) => void
  onVehicleModel: (v: string) => void
  inputClassName?: string
  disabled?: boolean
}

export function VinManualVehicleFields({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  onVehicleYear,
  onVehicleMake,
  onVehicleModel,
  inputClassName = '',
  disabled = false,
}: VinManualVehicleFieldsProps) {
  return (
    <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-amber-400/40 bg-amber-50/80 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      <p className="sm:col-span-3 text-xs text-amber-800 dark:text-amber-200">
        Enter year, make, and model below if decode is still running or failed — booking does not wait for
        NHTSA lookup.
      </p>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">Year *</label>
        <input
          type="number"
          min={1900}
          max={2100}
          required
          disabled={disabled}
          value={vehicleYear}
          onChange={(e) => onVehicleYear(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">Make *</label>
        <input
          type="text"
          required
          disabled={disabled}
          value={vehicleMake}
          onChange={(e) => onVehicleMake(e.target.value.toUpperCase())}
          className={inputClassName}
          placeholder="e.g. TOYOTA"
          style={{ textTransform: 'uppercase' }}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-gray-300">Model *</label>
        <input
          type="text"
          required
          disabled={disabled}
          value={vehicleModel}
          onChange={(e) => onVehicleModel(e.target.value)}
          className={inputClassName}
          placeholder="Model / trim"
        />
      </div>
    </div>
  )
}
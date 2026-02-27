-- Update existing demand_logs with Turkish notes to English
UPDATE demand_logs SET notes = 'Demand created (historical data)' WHERE notes = 'Demand created (geçmiş veri)';
UPDATE demand_logs SET notes = 'Approved (historical data)' WHERE notes = 'Onaylandı (geçmiş veri)';
UPDATE demand_logs SET notes = 'Completed (historical data)' WHERE notes = 'Tamamlandı (geçmiş veri)';
UPDATE demand_logs SET notes = 'Cancelled (historical data)' WHERE notes = 'İptal edildi (geçmiş veri)';

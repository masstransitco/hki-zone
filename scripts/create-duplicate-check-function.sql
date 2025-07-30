-- Create function to check for duplicate incidents
CREATE OR REPLACE FUNCTION get_duplicate_incidents()
RETURNS TABLE (
  source_published_at TIMESTAMPTZ,
  feed_slug TEXT,
  incident_count BIGINT,
  incident_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.source_published_at,
    f.base_slug as feed_slug,
    COUNT(*) as incident_count,
    array_agg(i.id) as incident_ids
  FROM incidents_unified i
  JOIN gov_feeds_unified f ON f.id = i.feed_id
  GROUP BY i.source_published_at, f.base_slug
  HAVING COUNT(*) > 1
  ORDER BY i.source_published_at DESC;
END;
$$ LANGUAGE plpgsql;
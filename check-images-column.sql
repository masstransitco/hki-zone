-- Check if images column exists in articles_unified table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'articles_unified' 
    AND column_name = 'images';

-- Check a sample of cars to see their images data
SELECT 
    id,
    title,
    image_url,
    images,
    created_at
FROM 
    articles_unified 
WHERE 
    category = 'cars' 
ORDER BY 
    created_at DESC 
LIMIT 5;

-- Count cars with images array vs without
SELECT 
    COUNT(*) FILTER (WHERE images IS NOT NULL) as cars_with_images_array,
    COUNT(*) FILTER (WHERE images IS NULL) as cars_without_images_array,
    COUNT(*) as total_cars
FROM 
    articles_unified 
WHERE 
    category = 'cars';
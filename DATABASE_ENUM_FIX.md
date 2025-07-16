# Database Enum Fix Required

## Issue
The PostgreSQL enum `incident_category` does not include the new values 'health', 'gov', and 'ae' that are needed for the Hong Kong government feeds implementation.

## Required SQL Commands
Run these commands on the database to add the missing enum values:

```sql
-- Add health category for A&E waiting times
ALTER TYPE incident_category ADD VALUE 'health';

-- Add gov category for government news
ALTER TYPE incident_category ADD VALUE 'gov';

-- Add ae category for A&E waiting times (alternative)
ALTER TYPE incident_category ADD VALUE 'ae';
```

## Verification
After running the commands, verify the enum values are available:

```sql
SELECT unnest(enum_range(NULL::incident_category)) as category;
```

## Current Workaround
Until the enum is fixed, the code temporarily maps:
- A&E feeds → 'health' category (fails, needs enum fix)
- Government feeds → 'administrative' category (works)

## Files Updated
- `/lib/government-feeds.ts` - Updated category mapping
- `/lib/types.ts` - Updated TypeScript types
- `/app/signals/page.tsx` - Updated category filters
- `/components/signals-list.tsx` - Updated category colors

## Status
❌ **BLOCKED** - Manual database administration required to add enum values
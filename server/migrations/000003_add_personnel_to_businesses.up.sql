ALTER TABLE businesses
ADD COLUMN sres TEXT[] DEFAULT '{}',
ADD COLUMN developers TEXT[] DEFAULT '{}',
ADD COLUMN testers TEXT[] DEFAULT '{}',
ADD COLUMN bizops TEXT[] DEFAULT '{}';

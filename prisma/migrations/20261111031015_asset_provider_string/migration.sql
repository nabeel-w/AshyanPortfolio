-- Asset.provider: enum → text, so new storage adapters never need a migration.
-- Cast in place (keeps rows and the (provider, providerKey) unique index) and map
-- old enum values to the adapter ids used in src/features/media/providers.
ALTER TABLE "Asset"
  ALTER COLUMN "provider" SET DATA TYPE TEXT
  USING (
    CASE "provider"::text
      WHEN 'MUX' THEN 'mux'
      WHEN 'CLOUDFLARE_STREAM' THEN 'cloudflare-stream'
      WHEN 'BUNNY_STREAM' THEN 'bunny-stream'
      WHEN 'VERCEL_BLOB' THEN 'vercel-blob'
      WHEN 'CLOUDFLARE_R2' THEN 's3'
      WHEN 'CLOUDINARY' THEN 'cloudinary'
      ELSE lower("provider"::text)
    END
  );

DROP TYPE "AssetProvider";

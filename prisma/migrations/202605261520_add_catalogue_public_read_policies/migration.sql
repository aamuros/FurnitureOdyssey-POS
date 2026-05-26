ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read page content"
ON public.page_content
FOR SELECT
USING (true);

CREATE POLICY "Public can read tags"
ON public.tags
FOR SELECT
USING (true);

CREATE POLICY "Public can read product tag assignments"
ON public.product_tag_assignments
FOR SELECT
USING (true);

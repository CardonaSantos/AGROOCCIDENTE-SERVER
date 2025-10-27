-- CreateTable
CREATE TABLE "_CategoriaToPresentacion" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CategoriaToPresentacion_AB_unique" ON "_CategoriaToPresentacion"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoriaToPresentacion_B_index" ON "_CategoriaToPresentacion"("B");

-- AddForeignKey
ALTER TABLE "_CategoriaToPresentacion" ADD CONSTRAINT "_CategoriaToPresentacion_A_fkey" FOREIGN KEY ("A") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoriaToPresentacion" ADD CONSTRAINT "_CategoriaToPresentacion_B_fkey" FOREIGN KEY ("B") REFERENCES "ProductoPresentacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

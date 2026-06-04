import { useState, useEffect } from 'react';
import PromoCard from '../components/PromoCard';

// 🛑 DATOS MOCK: Esto simula lo que te enviará el backend de Node.js en el futuro
const mockPromotions = [
    {
        id: 1,
        titulo: "Tacos de Pastor",
        precio: 80,
        negocio: "El Tío",
        etiqueta: "Disponible hoy",
        imagen: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=500&auto=format&fit=crop&q=60" // Usa imágenes reales o de Unsplash
    },
    {
        id: 2,
        titulo: "Hamburguesa Classic",
        precio: 120,
        negocio: "Burgers & Co.",
        etiqueta: "Oferta Relámpago",
        imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60"
    }
];

export default function Home() {
    // Lógica del Carrusel (Reemplaza a tu script estático)
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % 2); // % 2 porque tienes 2 slides
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <main className="pt-36 max-w-7xl mx-auto pb-32">
            {/* 1. Carrusel */}
            <section className="px-4 mb-8">
                <div className="relative w-full aspect-[21/9] overflow-hidden rounded-lg shadow-md bg-blue-900 flex items-center justify-center">
                    {/* Aquí irían tus imágenes del carrusel dependiendo de currentSlide */}
                    <h2 className="text-white text-2xl font-bold">Banner {currentSlide + 1}</h2>
                </div>
            </section>

            {/* 2. Categorías (Estático por ahora) */}
            {/* Seccion de Categorías */}
            <section className="px-margin-mobile mb-10">
                <h3 className="font-headline-md text-headline-md mb-4 text-on-surface">
                    Explora por categorías
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    {[
                        {
                            nombre: "Comida",
                            icono: "fastfood",
                            bg: "bg-[#E3F2FD]",
                            texto: "text-[#1976D2]",
                        },
                        {
                            nombre: "Ropa",
                            icono: "checkroom",
                            bg: "bg-[#E3F2FD]",
                            texto: "text-[#1976D2]",
                        },
                        {
                            nombre: "Servicios",
                            icono: "handyman",
                            bg: "bg-[#E3F2FD]",
                            texto: "text-[#1976D2]",
                        },
                        {
                            nombre: "Abarrotes",
                            icono: "local_grocery_store",
                            bg: "bg-[#E3F2FD]",
                            texto: "text-[#1976D2]",
                        },
                    ].map((cat, index) => (
                        <button
                            key={index}
                            className={`flex flex-col items-center justify-center p-1 rounded-lg ${cat.bg} hover:shadow-md transition-all active:scale-95 group`}
                        >
                            <div className="w-14 h-14 flex items-center justify-center bg-white/50 rounded-full group-hover:scale-110 transition-transform mb-3">
                                <span className={`material-symbols-outlined text-3xl ${cat.texto}`}>
                                    {cat.icono}
                                </span>
                            </div>
                            <span className={`font-label-lg text-label-lg ${cat.texto}`}>
                                {cat.nombre}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* 3. Feed de Promociones (Renderizando los Datos Mock) */}
            <section className="px-4 mb-12">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Promociones del día</h3>
                    <button className="text-primary font-bold hover:underline">Ver todo</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Iteramos sobre el arreglo de datos mock usando .map() */}
                    {mockPromotions.map((promo) => (
                        <PromoCard
                            key={promo.id}
                            imagen={promo.imagen}
                            etiqueta={promo.etiqueta}
                            titulo={promo.titulo}
                            precio={promo.precio}
                            negocio={promo.negocio}
                        />
                    ))}
                </div>
            </section>
        </main>
    );
}
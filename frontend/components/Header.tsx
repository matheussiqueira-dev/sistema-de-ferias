"use client";

import React from "react";
import Link from "next/link";
import { api } from "../lib/http";
import '@fortawesome/fontawesome-free/css/all.min.css';

const Header: React.FC = () => {
    return (
        <header className="bg-yellow-400 text-white p-4 flex justify-between items-center">

            <nav className="flex space-x-4 ">

                <Link href="/tela" className="hover:underline flex items-center space-x-1 text-[#023472]">
                    <i className="fa-solid fa-house"></i>
                    <span>Início</span>
                </Link>

                <Link href="/solicitar-ferias" className="hover:underline flex items-center space-x-1 text-[#023472]">
                    <i className="fa-solid fa-square-plus"></i>
                    <span>Solicitar</span>
                </Link>

                <Link href="/gerencias" className="hover:underline flex items-center space-x-1 text-[#023472]">
                    <i className="fas fa-sitemap"></i>
                    <span>Gerências</span>
                </Link>
                
                <Link href="/cadastro-funcionario" className="hover:underline flex items-center space-x-1 text-[#023472]">
                    <i className="fas fa-plus"></i>
                    <span>Cadastrar</span>
                </Link>

                
            </nav>
            <div className="flex items-center space-x-4">

                <button
                    type="button"
                    onClick={() => api.post("/logout").finally(() => window.location.assign("/login"))}
                    className="flex items-center space-x-2 hover:underline text-[#023472]"
                >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Sair</span>
                </button>
            </div>
        </header>
    );
};

export default Header;

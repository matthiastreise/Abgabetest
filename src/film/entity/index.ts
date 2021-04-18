/*
 * Copyright (C) 2021 - present Alexander Mader, Marius Gulden, Matthias Treise
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul besteht aus Interfaces, Klassen und Funktionen für Bücher als
 * _Entity_ gemäß _Domain Driven Design_. Dazu gehört auch die Validierung.
 * @packageDocumentation
 */

export { Film, FilmArt, FilmData, Studio } from './film';
export { FilmDocument, FilmModel, filmSchema } from './film.model';
export { MAX_RATING } from './jsonSchema';
export { ValidationErrorMsg, validateFilm } from './validateFilm';

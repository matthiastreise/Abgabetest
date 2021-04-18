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
 * Das Modul enthält Funktionen für den DB-Zugriff einschließlich GridFS und
 * Neuladen der Test-DB.
 * @packageDocumentation
 */

import type { FilmData } from '../../film/entity';

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Die Testdaten, um die Test-DB neu zu laden, als JSON-Array.
 */
export const testdaten: FilmData[] = [
    {
        _id: '00000000-0000-0000-0000-000000000001',
        titel: 'Die nackte Kanone',
        rating: 5,
        art: 'DVD',
        studio: 'ParamountPictures',
        preis: 10.95,
        rabatt: 0.7,
        lieferbar: true,
        // https://docs.mongodb.com/manual/reference/method/Date
        datum: new Date('1989-27-04'),
        isan: '645-3684268831',
        regisseur: 'David Zucker',
        genre: ['COMEDY'],
        darsteller: [
            {
                nachname: 'Nielsen',
                vorname: 'Leslie',
            },
            {
                nachname: 'Simpson',
                vorname: 'O.J.',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000002',
        titel: 'Im einem Land vor unserer Zeit',
        rating: 4,
        art: 'VHS',
        studio: 'UniversalPictures',
        preis: 5.49,
        rabatt: 0.1,
        lieferbar: true,
        datum: new Date('1989-22-06'),
        isan: '645-9747683251',
        regisseur: 'Don Bluth',
        genre: ['ABENTEUER'],
        darsteller: [
            {
                nachname: 'Foot',
                vorname: 'Little',
            },
            {
                nachname: 'Zahn',
                vorname: 'Raff',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000003',
        titel: 'Der Pate',
        rating: 3,
        art: 'VHS',
        studio: 'ParamountPictures',
        preis: 7.95,
        rabatt: 0.5,
        lieferbar: true,
        datum: new Date('1972-02-03'),
        isan: '645-9586267359',
        regisseur: 'Francis Ford Coppola',
        genre: ['DRAMA'],
        darsteller: [
            {
                nachname: 'Brando',
                vorname: 'Marlon',
            },
            {
                nachname: 'Pacino',
                vorname: 'Al',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000004',
        titel: 'Blood Diamond',
        rating: 3,
        art: 'DVD',
        studio: 'WarnerBros',
        preis: 5.1,
        rabatt: 0.1,
        lieferbar: true,
        datum: new Date('2007-25-01'),
        isan: '645-8694019572',
        regisseur: 'Edward Zwick',
        genre: ['ACTION'],
        darsteller: [
            {
                nachname: 'DiCaprio',
                vorname: 'Leonardo',
            },
            {
                nachname: 'Hounsou',
                vorname: 'Djimon',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        _id: '00000000-0000-0000-0000-000000000005',
        titel: 'Inside Out',
        rating: 2,
        art: 'BlueRay',
        studio: 'Pixar',
        preis: 12.95,
        rabatt: 0.08,
        lieferbar: true,
        datum: new Date('2015-18-05'),
        isan: '645-8579013452',
        regisseur: 'Pete Docter',
        genre: ['ANIMATION'],
        darsteller: [
            {
                nachname: 'Poehler',
                vorname: 'Amy',
            },
            {
                nachname: 'Smith',
                vorname: 'Phyllis',
            },
        ],
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];
Object.freeze(testdaten);

/* eslint-enable @typescript-eslint/naming-convention */

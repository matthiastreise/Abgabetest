/*
 * Copyright (C) 2016 - present Alexander, Matthias, Glynis
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Label, Interpret } from '../../../src/song/entity';
import { HttpMethod, agent, createTestserver } from '../../testserver';
import { HttpStatus, logger, serverConfig } from '../../../src/shared';
import { afterAll, beforeAll, describe, test } from '@jest/globals';
import fetch, { Headers, Request } from 'node-fetch';
import type { AddressInfo } from 'net';
import { PATHS } from '../../../src/app';
import type { Server } from 'http';
import chai from 'chai';
import { login } from '../../login';

const { expect } = chai;

// IIFE (= Immediately Invoked Function Expression) statt top-level await
// https://developer.mozilla.org/en-US/docs/Glossary/IIFE
(async () => {
    // startWith(), endWith()
    const chaiString = await import('chai-string');
    chai.use(chaiString.default);
})();

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const geaenderterSong: object = {
    titel: 'geänderterTest',
    label: Label.SONY_MUSIC,
    produzent: 'PASports',
    interpret: Interpret.TRIVIUM,
    lauflaenge: 3.22,
    erscheinungsdatum: '2016-02-28',
};
const idVorhanden = '00000000-0000-0000-0000-000000000002';

const geaenderterSongInvalid: object = {
    titel: 'FalschGeändertTest',
    label: 'klapptNicht',
    produzent: 'PASports',
    interpret: 'Falsch',
    lauflaenge: 3.22,
    erscheinungsdatum: '12-34556-111',
};

const veralterSong: object = {
    // isbn wird nicht geaendet
    titel: 'Veraltet',
    label: Label.ROADRUNNER_RECORDS,
    produzent: 'Quincy Jones',
    interpret: Interpret.ZUGEZOGENMASKULIN,
    lauflaenge: 3.02,
    erscheinungsdatum: new Date('2020-03-21'),
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
const path = PATHS.songs;
let server: Server;
let songsUri: string;
let loginUri: string;

// Test-Suite
describe('PUT /songs/:id', () => {
    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        server = await createTestserver();

        const address = server.address() as AddressInfo;
        const baseUri = `https://${serverConfig.host}:${address.port}`;
        songsUri = `${baseUri}${path}`;
        logger.info(`songsUri = ${songsUri}`);
        loginUri = `${baseUri}${PATHS.login}`;
    });

    afterAll(() => {
        server.close();
    });

    test('Vorhandenen Song aendern', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'If-Match': '"0"',
        });
        const body = JSON.stringify(geaenderterSong);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.NO_CONTENT);
        const responseBody = await response.text();
        expect(responseBody).to.be.empty;
    });

    test('Vorhandenen Song mit ungueltigen Daten aendern', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'If-Match': '"0"',
        });
        const body = JSON.stringify(geaenderterSongInvalid);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.BAD_REQUEST);
        const { label, erscheinungsdatum, interpret } = await response.json();

        expect(label).to.be.equal(
            'Das Label eines Songs muss SONY_MUSIC, ROADRUNNER_RECORDS, BETTERNOISE_MUSIC oder UNIVERSAL_MUSIC sein.',
        );
        expect(interpret).to.be.equal(
            'Der Interpret eines Songs muss TRIVIUM, FIVEFINGERDEATHPUNCH, ZUGEZOGENMASKULIN oder DENDEMANN sein.',
        );
        expect(erscheinungsdatum).to.contain('ist kein gueltiges Datum');
    });

    test('Vorhandenen Song ohne Versionsnummer aendern', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        });
        const body = JSON.stringify(geaenderterSong);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.PRECONDITION_REQUIRED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equal('Versionsnummer fehlt');
    });

    test('Vorhandenen Song mit alter Versionsnummer aendern', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'If-Match': '"-1"',
        });
        const body = JSON.stringify(veralterSong);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.PRECONDITION_FAILED);
        const responseBody = await response.text();
        expect(responseBody).to.have.string('Die Versionsnummer');
    });

    test('Vorhandenen Song ohne Token aendern', async () => {
        // given
        const headers = new Headers({
            'Content-Type': 'application/json',
            'If-Match': '"0"',
        });
        const body = JSON.stringify(geaenderterSong);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.UNAUTHORIZED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equalIgnoreCase('unauthorized');
    });

    test('Vorhandenen Song mit falschem Token aendern', async () => {
        // given
        const token = 'FALSCH';
        const headers = new Headers({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'If-Match': '"0"',
        });
        const body = JSON.stringify(geaenderterSong);
        const request = new Request(`${songsUri}/${idVorhanden}`, {
            method: HttpMethod.PUT,
            headers,
            body,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.UNAUTHORIZED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equalIgnoreCase('unauthorized');
    });
});

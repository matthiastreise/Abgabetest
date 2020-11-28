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

import { agent, createTestserver, HttpMethod } from '../../testserver';
import { HttpStatus, serverConfig } from '../../../src/shared';
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
const id = '00000000-0000-0000-0000-000000000001';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
let server: Server;
const path = PATHS.songs;
let songsUri: string;
let loginUri: string;

// Test-Suite
describe('DELETE /songs', () => {
    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        server = await createTestserver();

        const address = server.address() as AddressInfo;
        const baseUri = `https://${serverConfig.host}:${address.port}`;
        songsUri = `${baseUri}${path}`;
        loginUri = `${baseUri}${PATHS.login}`;
    });

    afterAll(() => {
        server.close();
    });

    test('Vorhandenen Song loeschen', async () => {
        // given
        const token = await login(loginUri);
        const headers = new Headers({ Authorization: `Bearer ${token}` });
        const request = new Request(`${songsUri}/${id}`, {
            method: HttpMethod.DELETE,
            headers,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.NO_CONTENT);
        const responseBody = await response.text();
        expect(responseBody).to.be.empty;
    });

    test('Song ohne Token loeschen', async () => {
        // given
        const request = new Request(`${songsUri}/${id}`, {
            method: HttpMethod.DELETE,
            agent,
        });

        // when
        const response = await fetch(request);

        // then
        expect(response.status).to.be.equal(HttpStatus.UNAUTHORIZED);
        const responseBody = await response.text();
        expect(responseBody).to.be.equalIgnoreCase('unauthorized');
    });

    test('Song mit falschem Token loeschen', async () => {
        // given
        const token = 'FALSCH';
        const headers = new Headers({ Authorization: `Bearer ${token}` });
        const request = new Request(`${songsUri}/${id}`, {
            method: HttpMethod.DELETE,
            headers,
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

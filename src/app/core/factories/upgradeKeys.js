angular.module('proton.core')
    .factory('upgradeKeys', (
        $log,
        CONSTANTS,
        gettextCatalog,
        Key,
        networkActivityTracker,
        notify,
        organizationApi,
        passwords,
        pmcw,
        secureSessionStorage,
        User
    ) => {
        /**
         * Change organization keys
         * @param  {String} password
         * @param  {Object} user
         * @return {Promise}
         */
        function manageOrganizationKeys(password = '', oldSaltedPassword = '', user = {}) {
            if (user.Role === CONSTANTS.PAID_ADMIN_ROLE) {
                // Get organization key
                return organizationApi.getKeys()
                .then(({ data = {} } = {}) => {
                    if (data.Code === 1000) {
                        const encryptPrivateKey = data.PrivateKey;
                        return pmcw.decryptPrivateKey(encryptPrivateKey, oldSaltedPassword)
                        .then((pkg) => Promise.resolve(pmcw.reformatKey(pkg, user.Addresses[0].Email, password)), () => Promise.resolve(0));
                    }
                    throw new Error(data.Error || gettextCatalog.getString('Unable to get organization keys', null, 'Error'));
                });
            }
            return Promise.resolve(0);
        }

        function manageUserKeys(password = '', oldSaltedPassword = '', user = {}) {
            const inputKeys = [];
            const emailAddresses = {};
             // Collect user keys
            user.Keys.forEach((key) => {
                inputKeys.push(key);
                let foundKey = null;
                user.Addresses.forEach((address) => {
                    foundKey = _.findWhere(address.Keys, { Fingerprint: key.Fingerprint });
                    if (foundKey) {
                        emailAddresses[key.ID] = address.Email;
                    }
                });
                if (foundKey != null) {
                    emailAddresses[key.ID] = user.Addresses[0].Email;
                }
            });
            // Collect address keys
            user.Addresses.forEach((address) => {
                address.Keys.forEach((key) => {
                    inputKeys.push(key);
                    emailAddresses[key.ID] = address.Email;
                });
            });
            // Reformat all keys, if they can be decrypted
            let promises = [];
            if (user.OrganizationPrivateKey) {
                // Admin logged in as sub-user
                const organizationKey = pmcw.decryptPrivateKey(user.OrganizationPrivateKey, oldSaltedPassword);

                promises = inputKeys.map(({ PrivateKey, ID, Token }) => {
                    // Decrypt private key with organization key and token
                    return organizationKey
                    .then((key) => pmcw.decryptMessage(Token, key))
                    .then(({ data }) => pmcw.decryptPrivateKey(PrivateKey, data))
                    .then((pkg) => ({ ID, pkg }));
                });
            } else {
                // Not sub-user
                promises = inputKeys.map(({ PrivateKey, ID }) => {
                    // Decrypt private key with the old mailbox password
                    return pmcw.decryptPrivateKey(PrivateKey, oldSaltedPassword)
                    .then((pkg) => ({ ID, pkg }));
                });
            }

            return promises.map((promise) => {
                return promise
                // Encrypt the key with the new mailbox password
                .then(
                    ({ ID, pkg }) => {
                        return pmcw.reformatKey(pkg, emailAddresses[ID], password)
                        .then((PrivateKey) => ({ ID, PrivateKey }));
                    },
                    (error) => {
                        // Cannot decrypt, return 0 (not an error)
                        $log.error(error);
                        return 0;
                    }
                );
            });
        }

        function sendNewKeys({ keys = [], keySalt = '', organizationKey = 0, loginPassword = '' }) {
            const keysFiltered = keys.filter((key) => key !== 0);
            const payload = { KeySalt: keySalt, Keys: keysFiltered };

            if (keysFiltered.length === 0) {
                throw new Error(gettextCatalog.getString('No keys to update', null, 'Error'));
            }

            if (organizationKey !== 0) {
                payload.OrganizationKey = organizationKey;
            }

            return Key.upgrade(payload, loginPassword);
        }

        return ({ mailboxPassword = '', oldSaltedPassword = '', user = {} }) => {
            const keySalt = passwords.generateKeySalt();
            const loginPassword = user.PasswordMode === 1 ? mailboxPassword : '';
            const promise = passwords.computeKeyPassword(mailboxPassword, keySalt)
                .then((passwordComputed) => {
                    const promises = [];
                    const collection = manageUserKeys(passwordComputed, oldSaltedPassword, user);

                    promises.push(manageOrganizationKeys(passwordComputed, oldSaltedPassword, user));
                    collection.forEach((promise) => promises.push(promise));

                    return Promise.all(promises);
                })
                .then(([organizationKey, ...keys]) => sendNewKeys({
                    keys,
                    keySalt,
                    organizationKey,
                    loginPassword
                }))
                .then(({ data = {} } = {}) => {
                    if (data.Code === 1000) {
                        if (!user.OrganizationPrivateKey) {
                            secureSessionStorage.setItem(CONSTANTS.MAILBOX_PASSWORD_KEY, pmcw.encode_utf8_base64(pwd));
                        }
                    }
                    //fail silently
                    return Promise.resolve();
                });
            networkActivityTracker.track(promise);
            return promise;
        };
    });

angular.module('proton.routes', [
    'ui.router',
    'proton.authentication',
    'proton.constants'
])

.config(function($stateProvider, $urlRouterProvider, $locationProvider, CONSTANTS) {
    var conversationParameters = function() {
      var parameters = [
        'page',
        'filter',
        'sort',
        'label',
        'from',
        'to',
        'subject',
        'words',
        'begin',
        'end',
        'attachments',
        'starred',
        'reload'
      ];

      return parameters.join('&');
    };

    $stateProvider

    // ------------
    // LOGIN ROUTES
    // ------------
    .state('login', {
        url: '/login',
        views: {
            'main@': {
                templateUrl: 'templates/layout/login.tpl.html'
            },
            'panel@login': {
                controller: 'LoginController',
                templateUrl: 'templates/views/login.tpl.html'
            }
        },
        onEnter: function(authentication) {
            // We automatically logout the user when he comes to login page
            authentication.logout(false);
        }
    })

    .state('login.unlock', {
        url: '/unlock',
        views: {
            'panel@login': {
                controller: 'LoginController',
                templateUrl: 'templates/views/unlock.tpl.html'
            }
        },
        onEnter: function($rootScope, $state, authentication) {
            if ($rootScope.TemporaryEncryptedPrivateKeyChallenge === undefined) {
                authentication.logout(true);
            }

            setTimeout( function() {
                $( '[type=password]' ).focus();
            }, 200);
        }
    })

    // -------------------------------------------
    // ACCOUNT ROUTES
    // -------------------------------------------
    .state('account', {
        url: '/account/:username/:token',
        resolve: {
            app: function($stateParams, $state, $q, User) {
                var defer = $q.defer();

                User.checkInvite({
                    username: $stateParams.username,
                    token: $stateParams.token
                }).$promise.then(function(response) {
                    defer.resolve();
                }, function(response) {
                    defer.reject(response);
                });

                return defer.promise;
            }
        },
        views: {
            'main@': {
                controller: 'SetupController',
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@account': {
                templateUrl: 'templates/views/sign-up.tpl.html'
            }
        }
    })

    // DISBALED FOR NOW :)
    .state('signup', {
        url: '/signup',
        views: {
            'main@': {
                controller: 'SignupController',
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@signup': {
                templateUrl: 'templates/views/sign-up.tpl.html'
            }
        },
        onEnter: function($rootScope, $state) {
            if ($rootScope.allowedNewAccount!==true) {
                $state.go('login');
            }
        }
    })

    .state('pre-invite', {
        url: '/pre-invite/:user/:token',
        views: {
            'main@': {
                templateUrl: 'templates/layout/pre.tpl.html'
            }
        },
        onEnter: function($http, url, CONFIG, $state, $stateParams, $rootScope, notify, authentication) {
            // clear user data if already logged in:
            authentication.logout(false);
            $rootScope.loggingOut = false;

            $http.post( url.get() + '/users/' + $stateParams.token + '/check', { Username: $stateParams.user } )
            .then(
                function( response ) {
                    if (response.data.Valid===1) {

                        $rootScope.allowedNewAccount = true;
                        $rootScope.inviteToken = $stateParams.token;
                        $rootScope.preInvited = true;
                        $rootScope.username = $stateParams.user;
                        $state.go('step1');
                    }
                    else {
                        notify({
                            message: 'Invalid Invite Link.',
                            classes: 'notification-danger'
                        });
                        $state.go('login');
                    }
                }
            );
        }
    })

    .state('step1', {
        url: '/create/new',
        views: {
            'main@': {
                controller: 'SignupController',
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@step1': {
                templateUrl: 'templates/views/step1.tpl.html'
            }
        },
        onEnter: function($rootScope, $state, $log) {
            // This is how we currently prevent direct sign ups. Remove this to let open the flood gates.
            if ($rootScope.allowedNewAccount!==true) {
                $state.go('login');
            }
        }
    })

    .state('step2', {
        url: '/create/mbpw',
        views: {
            'main@': {
                controller: 'SignupController',
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@step2': {
                templateUrl: 'templates/views/step2.tpl.html'
            }
        },
        onEnter: function(authentication, $state, $rootScope, $log) {
            if ($rootScope.allowedNewAccount!==true) {
                $state.go('login');
            }
            if (authentication.isLoggedIn()) {
                $rootScope.isLoggedIn = true;
                return authentication.fetchUserInfo().then(
                function() {
                    $rootScope.user = authentication.user;
                    $rootScope.pubKey = authentication.user.PublicKey;
                    $rootScope.user.DisplayName = authentication.user.addresses[0].Email;
                    if ($rootScope.pubKey === 'to be modified') {
                        return;
                    } else {
                        $state.go('login.unlock');
                        return;
                    }
                });
            } else {
                $log.debug('step2.onEnter:1');
                $state.go('login');
                return;
            }
        }
    })

    .state('reset', {
        url: '/reset',
        views: {
            'main@': {
                controller: 'SetupController',
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@reset': {
                templateUrl: 'templates/views/reset.tpl.html'
            }
        },
        resolve: {
            token: function($http, $rootScope, authentication, url, CONFIG) {
                return $http.post(url.get() + '/auth',
                    _.extend(_.pick($rootScope.creds, 'Username', 'Password', 'HashedPassword'), {
                        ClientID: CONFIG.clientID,
                        ClientSecret: CONFIG.clientSecret,
                        GrantType: 'password',
                        State: authentication.randomString(24),
                        RedirectURI: 'https://protonmail.com',
                        ResponseType: 'token',
                        Scope: 'reset'
                    })
                );
            }
        },
        onEnter: function($rootScope, $state, $log) {
            if ($rootScope.TemporaryAccessData===undefined) {
                $log.debug('reset.onEnter:1');
                $state.go('login');
                return;
            }
        }
    })

    // -------------------------------------------
    // UPGRADE ROUTES
    // -------------------------------------------
    .state('upgrade', {
        url: '/upgrade',
        views: {
            'main@': {
                templateUrl: 'templates/layout/auth.tpl.html'
            },
            'panel@upgrade': {
                controller: 'UpgradeController',
                templateUrl: 'templates/views/upgrade.tpl.html'
            }
        }
    })

    // -------------------------------------------
    // SUPPORT ROUTES
    // -------------------------------------------
    .state('support', {
        url: '/help',
        views: {
            'main@': {
                controller: 'SupportController',
                templateUrl: 'templates/layout/auth.tpl.html'
            }
        }
    })

    .state('support.message', {
        params: {
            data: null
        }, // Tip to avoid passing parameters in the URL
        url: '/message',
        onEnter: function($state, $stateParams) {
            if ($stateParams.data === null) {
                $state.go('login');
            }
        },
        views: {
            'panel@support': {
                templateUrl: 'templates/views/support-message.tpl.html'
            }
        }
    })

    .state('support.reset-password', {
        url: '/reset-login-password',
        views: {
            'panel@support': {
                templateUrl: 'templates/views/reset-password.tpl.html'
            }
        }
    })

    .state('support.confirm-new-password', {
        url: '/confirm-new-password/:token',
        onEnter: function($stateParams, $state, Reset) {
            var token = $stateParams.token;

            // Check if reset token is valid
            Reset.validateResetToken({
                token: token
            }).then(
                function(response) {
                    // console.log(response.data);
                    if (response.data.Error) {
                        $state.go('support.message', {
                            data: {
                                title: response.data.Error,
                                content: response.data.Error,
                                type: 'alert-danger'
                            }
                        });
                    }
                },
                function() {
                    $state.go('support.message', {
                        data: {
                            title: 'Reset Error',
                            content: 'Sorry, we are unable to reset your password right now. Please try the link again in a few minutes.',
                            type: 'alert-danger'
                        }
                    });
                }
            );
        },
        views: {
            'panel@support': {
                templateUrl: 'templates/views/confirm-new-password.tpl.html'
            }
        }
    })

    // Deprecated?
    .state('support.reset-mailbox', {
        url: '/reset-mailbox/:token',
        onEnter: function($stateParams, $state, $rootScope, authentication) {
            $rootScope.resetMailboxToken = $stateParams.token;
            if (!!!authentication.isLoggedIn()) {
                event.preventDefault();
                $state.go('login');
            }
            else {
                $state.go('reset');
            }
        },
        views: {
            'panel@support': {
                templateUrl: 'templates/views/confirm-new-password.tpl.html'
            }
        }
    })

    // -------------------------------------------
    // ENCRYPTION OUTSIDE
    // -------------------------------------------
    .state('eo', {
        abstract: true,
        views: {
            'main@': {
                templateUrl: 'templates/layout/outside.tpl.html'
            }
        }
    })

    .state('eo.unlock', {
        url: '/eo/:tag',
        resolve: {
            encryptedToken: function(Eo, $stateParams) {
                return Eo.token($stateParams.tag);
            }
        },
        views: {
            'content': {
                templateUrl: 'templates/views/outside.unlock.tpl.html',
                controller: function($scope, $state, $stateParams, pmcw, encryptedToken, networkActivityTracker, notify) {
                    $scope.params = {};
                    $scope.params.MessagePassword = '';

                    if(encryptedToken.data.Error) {
                        $scope.tokenError = true;
                    } else {
                        $scope.tokenError = false;
                        encryptedToken = encryptedToken.data.Token;
                    }

                    $scope.unlock = function() {
                        var promise = pmcw.decryptMessage(encryptedToken, $scope.params.MessagePassword);

                        promise.then(function(decryptedToken) {
                            window.sessionStorage['proton:decrypted_token'] = decryptedToken;
                            window.sessionStorage['proton:encrypted_password'] = pmcw.encode_utf8_base64($scope.params.MessagePassword);
                            $state.go('eo.message', {tag: $stateParams.tag});
                        }, function(err) {
                            notify({message: err.message, classes: 'notification-danger'});
                        });
                    };
                }
            }
        }
    })

    .state('eo.message', {
        url: '/eo/message/:tag',
        resolve: {
            message: function($stateParams, $q, Eo, Message, pmcw) {
                var deferred = $q.defer();
                var token_id = $stateParams.tag;
                var decrypted_token = window.sessionStorage['proton:decrypted_token'];
                var password = pmcw.decode_utf8_base64(window.sessionStorage['proton:encrypted_password']);

                Eo.message(decrypted_token, token_id)
                .then(function(result) {
                    var message = result.data.Message;
                    var promises = [];

                    promises.push(pmcw.decryptMessageRSA(message.Body, password, message.Time).then(function(body) {
                        message.Body = body;
                    }));

                    _.each(message.Replies, function(reply) {
                        promises.push(pmcw.decryptMessageRSA(reply.Body, password, reply.Time).then(function(body) {
                            reply.Body = body;
                        }));
                    });

                    $q.all(promises).then(function() {
                        message.displayMessage = true;
                        deferred.resolve(new Message(message));
                    });
                });

                return deferred.promise;
            }
        },
        views: {
            'content': {
                controller: 'OutsideController',
                templateUrl: 'templates/views/outside.message.tpl.html'
            }
        }
    })

    .state('eo.reply', {
        url: '/eo/reply/:tag',
        resolve: {
            message: function($stateParams, $q, Eo, Message, pmcw) {
                var deferred = $q.defer();
                var token_id = $stateParams.tag;
                var decrypted_token = window.sessionStorage['proton:decrypted_token'];
                var password = pmcw.decode_utf8_base64(window.sessionStorage['proton:encrypted_password']);

                Eo.message(decrypted_token, token_id)
                .then(
                    function(result) {
                        var message = result.data.Message;
                        message.publicKey = result.data.PublicKey;
                        pmcw.decryptMessageRSA(message.Body, password, message.Time)
                        .then(
                            function(body) {
                                message.Body = '<br /><br /><blockquote>' + body + '</blockquote>';
                                message.Attachments = [];
                                message.replyMessage = true;
                                deferred.resolve(new Message(message));
                            })
                        ;
                    }
                );

                return deferred.promise;
            }
        },
        views: {
            'content': {
                controller: 'OutsideController',
                templateUrl: 'templates/views/outside.reply.tpl.html'
            }
        }
    })

    // -------------------------------------------
    // SECURED ROUTES
    // this includes everything after login/unlock
    // -------------------------------------------

    .state('secured', {
        // This is included in every secured.* sub-controller
        abstract: true,
        views: {
            'main@': {
                controller: 'SecuredController',
                templateUrl: 'templates/layout/secured.tpl.html'
            }
        },
        resolve: {
            // Contains also labels and contacts
            user: function(authentication, $log, $http, pmcw) {
                if(angular.isObject(authentication.user)) {
                    return authentication.user;
                } else {
                    if(angular.isDefined(window.sessionStorage.getItem(CONSTANTS.OAUTH_KEY+':SessionToken'))) {
                        $http.defaults.headers.common['x-pm-session'] = pmcw.decode_base64(window.sessionStorage.getItem(CONSTANTS.OAUTH_KEY+':SessionToken'));
                    }

                    return authentication.fetchUserInfo(); // TODO need to rework this just for the locked page
                }
            }
        },
        onEnter: function(authentication) {
            // This will redirect to a login step if necessary
            authentication.redirectIfNecessary();
        }
    })

    .state('secured.print', {
        url: '/print/:id',
        onEnter: function($rootScope) {
            $rootScope.isBlank = true;
            $rootScope.printMode = true;
        },
        onExit: function($rootScope) {
            $rootScope.isBlank = false;
            $rootScope.printMode = false;
        },
        views: {
            'main@': {
                controller: 'MessageController',
                templateUrl: 'templates/views/message.print.tpl.html',
            }
        }
    })

    .state('secured.contacts', {
        url: '/contacts',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/contacts.tpl.html',
                controller: 'ContactsController'
            }
        }
    })

    .state('secured.account', {
        url: '/account',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/account.tpl.html',
                controller: 'AccountController'
            }
        }
    })

    .state('secured.labels', {
        url: '/labels',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/labels.tpl.html',
                controller: 'LabelsController'
            }
        }
    })

    .state('secured.example', {
        url: '/example',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/example.tpl.html',
                controller: 'LabelsController'
            }
        }
    })

    .state('secured.security', {
        url: '/security',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/security.tpl.html',
                controller: 'SecurityController'
            }
        }
    })


    .state('secured.appearance', {
        url: '/appearance',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/appearance.tpl.html',
                controller: 'AppearanceController'
            }
        }
    })

    .state('secured.invoice', {
        url: '/invoice/:time',
        onEnter: function($rootScope) {
            $rootScope.isBlank = true;
            $rootScope.printMode = true;
        },
        onExit: function($rootScope) {
            $rootScope.isBlank = false;
            $rootScope.printMode = false;
        },
        resolve: {
            invoice: function(user, $stateParams, $q, Payment) {
                var deferred = $q.defer();
                var time = $stateParams.time;
                var limit = 1;

                Payment.organization(time, limit).then(function(result) {
                    if(angular.isDefined(result.data) && result.data.Code === 1000) {
                        deferred.resolve(_.first(result.data.Payments));
                    } else {
                        deferred.reject();
                    }
                }, function() {
                    deferred.reject();
                });

                return deferred.promise;
            }
        },
        views: {
            'main@': {
                templateUrl: 'templates/views/invoice.print.tpl.html',
                controller: function($scope, invoice) {
                    $scope.invoice = invoice;

                    // Print current invoice
                    $scope.print = function() {
                        window.print();
                    };
                },
            }
        }
    })

    .state('secured.invoices', {
        url: '/invoices',
        resolve: {
            access: function(user, $q) {
                var deferred = $q.defer();

                if(user.Role === 2) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }

                return deferred.promise;
            }
        },
        views: {
            'content@secured': {
                templateUrl: 'templates/views/invoices.tpl.html',
                controller: 'InvoicesController'
            }
        }
    })

    .state('secured.keys', {
        url: '/keys',
        resolve: {
            access: function(user, $q) {
                var deferred = $q.defer();

                if(user.Role === 2) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }

                return deferred.promise;
            }
        },
        views: {
            'content@secured': {
                templateUrl: 'templates/views/keys.tpl.html',
                controller: 'KeysController'
            }
        }
    })

    .state('secured.dashboard', {
        url: '/dashboard',
        resolve: {
            access: function(user, $q) {
                var deferred = $q.defer();

                if(user.Role === 0 || user.Role === 2) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }

                return deferred.promise;
            },
            organization: function(user, Organization, networkActivityTracker) {
                if(user.Role === 2) {
                    return networkActivityTracker.track(Organization.get({Status: true})); // Get also the status payment history
                } else {
                    return true;
                }
            },
            subscriptions: function(user, Payment, networkActivityTracker) {
                return networkActivityTracker.track(Payment.subscriptions());
            }
        },
        views: {
            'content@secured': {
                templateUrl: 'templates/views/dashboard.tpl.html',
                controller: 'DashboardController'
            }
        }
    })

    .state('secured.members', {
        url: '/members',
        resolve: {
            access: function(user, $q) {
                var deferred = $q.defer();

                if(user.Role === 2) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }

                return deferred.promise;
            },
            organization: function(user, Organization, networkActivityTracker) {
                if(user.Role === 2) {
                    return networkActivityTracker.track(Organization.get());
                } else {
                    return true;
                }
            },
            members: function(Member, networkActivityTracker) {
                return networkActivityTracker.track(Member.query());
            }
        },
        views: {
            'content@secured': {
                templateUrl: 'templates/views/members.tpl.html',
                controller: 'MembersController'
            }
        }
    })

    .state('secured.domains', {
        url: '/domains',
        resolve: {
            access: function(user, $q) {
                var deferred = $q.defer();

                if(user.Role === 2) {
                    deferred.resolve();
                } else {
                    deferred.reject();
                }

                return deferred.promise;
            },
            organization: function(user, Organization, networkActivityTracker) {
                if(user.Role === 2) {
                    return networkActivityTracker.track(Organization.get());
                } else {
                    return true;
                }
            },
            members: function(Member, networkActivityTracker) {
                return networkActivityTracker.track(Member.query());
            },
            domains: function(Domain, networkActivityTracker) {
                return networkActivityTracker.track(Domain.query());
            }
        },
        views: {
            'content@secured': {
                templateUrl: 'templates/views/domains.tpl.html',
                controller: 'DomainsController'
            }
        }
    })

    .state('secured.themeReset', {
        url: '/theme-reset',
        views: {
            'content@secured': {
                templateUrl: 'templates/views/theme-reset.tpl.html',
                controller: 'SettingsController'
            }
        },
        onEnter: function(Setting, user, $state) {
            Setting.theme({
              'Theme': ''
            }).$promise.then(
                function(response) {
                    user.Theme = '';
                    $state.go('secured.inbox.list');
                    return;
                },
                function(response) {
                    $state.go('secured.inbox.list');
                    return;
                }
            );
        }

    });

    _.each(CONSTANTS.MAILBOX_IDENTIFIERS, function(id, box) {
        var parentState = 'secured.' + box;
        var listState = 'secured.' + box + '.list';
        var viewState = 'secured.' + box + '.list.view';
        var list = {};
        var view = {};

        list['list@secured.' + box] = {
            templateUrl: 'templates/partials/conversations.tpl.html',
            controller: 'ConversationsController'
        };

        view['view@secured.' + box] = {
            templateUrl: 'templates/partials/conversation.tpl.html',
            controller: 'ConversationController',
            resolve: {
                conversation: function($stateParams, cache, networkActivityTracker) {
                    if(angular.isDefined($stateParams.id)) {
                        return networkActivityTracker.track(cache.getConversation($stateParams.id));
                    } else {
                        return true;
                    }
                },
                messages: function($stateParams, cache, networkActivityTracker) {
                    if(angular.isDefined($stateParams.id)) {
                        return networkActivityTracker.track(cache.queryConversationMessages($stateParams.id));
                    } else {
                        return true;
                    }
                },
                loc: function($stateParams) {
                    return $stateParams.id;
                }
            }
        };

        $stateProvider.state(parentState, {
            abstract: true,
            url: '/' + box + '?' + conversationParameters(),
            onExit: function($rootScope) {
                $rootScope.showWelcome = false;
            },
            views: {
                'content@secured': {
                    templateUrl: 'templates/layout/conversations.tpl.html'
                }
            }
        });

        $stateProvider.state(listState, {
            url: '',
            views: list
        });

        $stateProvider.state(viewState, {
            url: '/{id}',
            views: view,
            onExit: function($rootScope) {
                $rootScope.$broadcast('unactiveMessages');
            }
        });
    });

    $urlRouterProvider.otherwise(function($injector) {
        var $state = $injector.get('$state');
        var stateName = $injector.get('authentication').state() || 'secured.inbox.list';
        return $state.href(stateName);
    });

    $locationProvider.html5Mode(true);
})

.run(function($rootScope, $state, $stateParams) {
    $rootScope.go = _.bind($state.go, $state);

    $rootScope.idDefined = function() {
        var id = $stateParams.id;

        return angular.isDefined(id) && id.length > 0;
    };

    $rootScope.deselectAll = function() {
        $rootScope.$broadcast('unselectAllElements');
    };
});
